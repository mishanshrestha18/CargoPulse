'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/contexts/NotificationContext';
import { showToast } from '@/components/ToastContainer';

/**
 * ShipmentMonitor - Background component that monitors multi-item shipments
 *
 * When a shipment arrives:
 * 1. Fetches the shipment
 * 2. Fetches all shipment_items for that shipment
 * 3. For each item: Upserts inventory at destination
 * 4. Updates shipment, vehicle, and driver status
 * 5. Shows notifications
 */
export default function ShipmentMonitor() {
  const { addNotification } = useNotifications();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
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
            destination,
            drivers (
              name
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
              // Fetch all shipment_items for this shipment
              const { data: shipmentItems, error: itemsError } = await supabase
                .from('shipment_items')
                .select('*')
                .eq('shipment_id', shipment.id);

              if (itemsError) {
                console.error(`Error fetching shipment items for ${shipment.id}:`, itemsError);
                continue;
              }

              console.log(`Processing ${shipmentItems?.length || 0} items for shipment ${shipment.id}`);

              // Get destination name
              const locationData = shipment.locations_destination as any;
              const destinationName = locationData?.name;

              if (!destinationName) {
                console.error(`No destination name for shipment ${shipment.id}`);
                continue;
              }

              // === INVENTORY TRANSFER LOGIC ===
              // Loop through each item and upsert at destination
              let totalItems = 0;
              const processedItems: string[] = [];

              if (shipmentItems && shipmentItems.length > 0) {
                for (const item of shipmentItems) {
                  try {
                    // Step A: Check if item exists at destination
                    const { data: existingInventory, error: checkError } = await supabase
                      .from('inventory')
                      .select('*')
                      .eq('location', destinationName)
                      .eq('item_name', item.item_name)
                      .maybeSingle();

                    if (checkError) {
                      console.error(`Error checking destination inventory for ${item.item_name}:`, checkError);
                      continue;
                    }

                    // Step B: Upsert logic
                    if (existingInventory) {
                      // UPDATE: Item exists at destination, increment quantity
                      const newQuantity = existingInventory.quantity + item.quantity;
                      const { error: updateError } = await supabase
                        .from('inventory')
                        .update({
                          quantity: newQuantity,
                          status: newQuantity > 0 ? 'In Stock' : 'Out of Stock'
                        })
                        .eq('id', existingInventory.id);

                      if (updateError) {
                        console.error(`Error updating inventory for ${item.item_name}:`, updateError);
                      } else {
                        console.log(`✅ Updated ${destinationName}: ${item.item_name} +${item.quantity} (now ${newQuantity})`);
                        totalItems += item.quantity;
                        processedItems.push(`${item.quantity}x ${item.item_name}`);
                      }
                    } else {
                      // INSERT: Item doesn't exist at destination, create new inventory row
                      // Get original inventory details for price/sku
                      const { data: originalInventory } = await supabase
                        .from('inventory')
                        .select('price_per_unit, sku')
                        .eq('id', item.inventory_item_id)
                        .single();

                      const { error: insertError } = await supabase
                        .from('inventory')
                        .insert({
                          item_name: item.item_name,
                          quantity: item.quantity,
                          location: destinationName,
                          status: 'In Stock',
                          price_per_unit: originalInventory?.price_per_unit || item.price_per_unit || 0,
                          sku: originalInventory?.sku || `SKU-${Date.now()}`,
                        });

                      if (insertError) {
                        console.error(`Error inserting inventory for ${item.item_name}:`, insertError);
                      } else {
                        console.log(`✅ Created ${destinationName}: ${item.item_name} (${item.quantity} units)`);
                        totalItems += item.quantity;
                        processedItems.push(`${item.quantity}x ${item.item_name}`);
                      }
                    }
                  } catch (itemErr) {
                    console.error(`Error processing item ${item.item_name}:`, itemErr);
                  }
                }
              }

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

              // Get driver name for notifications
              const driverData = shipment.drivers as any;
              const driverName = driverData?.name || 'Unknown Driver';

              // Create summary message
              const itemsSummary = processedItems.length === 1
                ? processedItems[0]
                : `${processedItems.length} items (${totalItems} total units)`;

              // Add notification to sidebar
              addNotification(
                'arrival',
                'Shipment Arrived',
                `${itemsSummary} arrived at ${destinationName}. ${driverName} is now available.`
              );

              // Show toast notification
              showToast(
                'arrival',
                'Shipment Delivered!',
                `${driverName} delivered ${itemsSummary} to ${destinationName}`
              );

              // Show browser notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Shipment Arrived!', {
                  body: `${driverName} delivered ${itemsSummary} to ${destinationName}`,
                  icon: '/favicon.ico',
                  tag: `shipment-${shipment.id}`,
                });
              }

              console.log(`✅ Shipment ${shipment.id} completed: ${itemsSummary} delivered to ${destinationName}`);
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
  }, [addNotification]);

  // This component doesn't render anything visible
  return null;
}
