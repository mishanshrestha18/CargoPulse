'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/contexts/NotificationContext';
import { showToast } from '@/components/ToastContainer';

/**
 * ShipmentMonitor - Background component that monitors shipments in transit
 *
 * This component runs silently in the background and checks every 30 seconds
 * for shipments that have completed their journey (arrival_time <= NOW()).
 *
 * When a shipment is completed, it:
 * 1. Updates the shipment status to 'Delivered'
 * 2. Sets the vehicle status back to 'Idle'
 * 3. Sets the driver status back to 'Idle'
 * 4. Shows a browser notification
 */
export default function ShipmentMonitor() {
  const { addNotification } = useNotifications();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Function to check for completed shipments
    const checkCompletedShipments = async () => {
      try {
        // Query for shipments that are In Transit and past their arrival time
        const { data: completedShipments, error: queryError } = await supabase
          .from('shipments')
          .select(`
            id,
            driver_id,
            vehicle_id,
            arrival_time,
            quantity,
            inventory_item_id,
            item_name,
            destination,
            origin,
            drivers (
              name
            ),
            inventory (
              item_name,
              price_per_unit,
              sku,
              status
            ),
            locations_destination:locations!shipments_destination_fkey (
              name
            )
          `)
          .eq('status', 'In Transit')
          .lte('arrival_time', new Date().toISOString());

        if (queryError) {
          console.error('Error querying shipments:', queryError);
          return;
        }

        // Process each completed shipment
        if (completedShipments && completedShipments.length > 0) {
          console.log(`Found ${completedShipments.length} completed shipment(s)`);

          for (const shipment of completedShipments) {
            try {
              // Update shipment status to Delivered
              const { error: shipmentError } = await supabase
                .from('shipments')
                .update({ status: 'Delivered' })
                .eq('id', shipment.id);

              if (shipmentError) throw shipmentError;

              // Update vehicle status to Idle
              const { error: vehicleError } = await supabase
                .from('vehicles')
                .update({ status: 'Idle' })
                .eq('id', shipment.vehicle_id);

              if (vehicleError) throw vehicleError;

              // Update driver status to Idle
              const { error: driverError } = await supabase
                .from('drivers')
                .update({ status: 'Idle' })
                .eq('id', shipment.driver_id);

              if (driverError) throw driverError;

              // === INVENTORY TRANSFER LOGIC ===
              // Move stock from origin to destination
              const originInventoryData = shipment.inventory as any;
              const itemNameToTransfer = shipment.item_name || originInventoryData?.item_name;
              const locationData = shipment.locations_destination as any;
              const destinationName = locationData?.name || 'destination';

              if (itemNameToTransfer && destinationName) {
                try {
                  // Step A: Check if item exists at destination (using location NAME, not ID)
                  const { data: existingInventory, error: checkError } = await supabase
                    .from('inventory')
                    .select('*')
                    .eq('location', destinationName)
                    .eq('item_name', itemNameToTransfer)
                    .maybeSingle();

                  if (checkError) {
                    console.error('Error checking destination inventory:', checkError);
                  } else {
                    // Step B: Upsert logic
                    if (existingInventory) {
                      // UPDATE: Item exists at destination, increment quantity
                      const { error: updateError } = await supabase
                        .from('inventory')
                        .update({
                          quantity: existingInventory.quantity + shipment.quantity
                        })
                        .eq('id', existingInventory.id);

                      if (updateError) {
                        console.error('Error updating destination inventory:', updateError);
                      } else {
                        console.log(`✅ Updated inventory at ${destinationName}: ${itemNameToTransfer} +${shipment.quantity} units (now ${existingInventory.quantity + shipment.quantity})`);
                      }
                    } else {
                      // INSERT: Item doesn't exist at destination, create new inventory row
                      const { error: insertError } = await supabase
                        .from('inventory')
                        .insert({
                          item_name: itemNameToTransfer,
                          quantity: shipment.quantity,
                          location: destinationName,
                          status: 'In Stock',
                          price_per_unit: originInventoryData?.price_per_unit || 0,
                          sku: originInventoryData?.sku || `SKU-${Date.now()}`,
                        });

                      if (insertError) {
                        console.error('Error inserting destination inventory:', insertError);
                      } else {
                        console.log(`✅ Created new inventory at ${destinationName}: ${itemNameToTransfer} (${shipment.quantity} units)`);
                      }
                    }
                  }
                } catch (inventoryErr) {
                  console.error('Error during inventory transfer:', inventoryErr);
                }
              }

              // Get shipment details for notification
              const driverData = shipment.drivers as any;
              const driverName = driverData?.name || 'Unknown Driver';
              const itemName = shipment.item_name || originInventoryData?.item_name || 'Unknown Item';
              // destinationName already declared above for inventory transfer

              // Add notification to sidebar
              addNotification(
                'arrival',
                'Shipment Arrived',
                `${shipment.quantity}x ${itemName} arrived at ${destinationName}. ${driverName} is now available.`
              );

              // Show toast notification
              showToast(
                'arrival',
                'Shipment Arrived!',
                `${driverName} delivered ${shipment.quantity}x ${itemName} to ${destinationName}`
              );

              // Show browser notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Shipment Arrived!', {
                  body: `${driverName} delivered ${shipment.quantity}x ${itemName} to ${destinationName}`,
                  icon: '/favicon.ico',
                  tag: `shipment-${shipment.id}`,
                });
              }

              console.log(`Shipment arrived! ${driverName} delivered ${shipment.quantity}x ${itemName} to ${destinationName}`);
            } catch (err) {
              console.error(`Error processing shipment ${shipment.id}:`, err);
            }
          }
        }
      } catch (err) {
        console.error('Error in checkCompletedShipments:', err);
      }
    };

    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Run check immediately on mount
    checkCompletedShipments();

    // Set up interval to check every 30 seconds
    intervalRef.current = setInterval(checkCompletedShipments, 30000);

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // This component doesn't render anything visible
  return null;
}
