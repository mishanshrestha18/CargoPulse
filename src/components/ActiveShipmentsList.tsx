'use client';

import { useEffect, useState } from 'react';
import { Truck, Plane, Package, MapPin, XCircle, Users, Clock, TrendingUp, CheckCircle, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/contexts/NotificationContext';
import { showToast } from '@/components/ToastContainer';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ShipmentItem {
  id: number;
  inventory_item_id: string;
  item_name: string;
  quantity: number;
  price_per_unit: number;
  total_cost: number;
}

interface ActiveShipment {
  id: string;
  driver_id: string;
  vehicle_id: string;
  origin: string;
  destination: string;
  inventory_item_id: string;
  item_name?: string;
  quantity: number;
  arrival_time: string;
  created_at: string;
  status: string;
  urgency: string;
  shipping_method: string;
  total_cost: number;
  drivers: { name: string };
  vehicles: { name: string };
  locations_origin: { name: string };
  locations_destination: { name: string };
  inventory: { item_name: string; price_per_unit?: number; sku?: string };
  shipment_items?: ShipmentItem[];  // For multi-item shipments
}

interface Driver {
  id: string;
  name: string;
  status: string;
}

interface ActiveShipmentsListProps {
  refreshTrigger?: number;
  onShipmentChange?: () => void;
}

export default function ActiveShipmentsList({ refreshTrigger, onShipmentChange }: ActiveShipmentsListProps) {
  const { addNotification } = useNotifications();
  const [shipments, setShipments] = useState<ActiveShipment[]>([]);
  const [idleDrivers, setIdleDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swappingShipmentId, setSwappingShipmentId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedShipmentId, setExpandedShipmentId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch active shipments
      const { data: shipmentsData, error: shipmentsError } = await supabase
        .from('shipments')
        .select('*')
        .eq('status', 'In Transit')
        .order('created_at', { ascending: false });

      if (shipmentsError) throw shipmentsError;

      // Fetch related data separately to avoid join issues
      const [driversRes, vehiclesRes, locationsRes, inventoryRes, idleDriversRes] = await Promise.all([
        supabase.from('drivers').select('id, name'),
        supabase.from('vehicles').select('id, name'),
        supabase.from('locations').select('id, name'),
        supabase.from('inventory').select('id, item_name, price_per_unit, sku'),
        supabase.from('drivers').select('*').eq('status', 'Idle').order('name'),
      ]);

      // Create lookup maps
      const driversMap = new Map(driversRes.data?.map(d => [String(d.id), d]) || []);
      const vehiclesMap = new Map(vehiclesRes.data?.map(v => [String(v.id), v]) || []);
      const locationsMap = new Map(locationsRes.data?.map(l => [String(l.id), l]) || []);
      const inventoryMap = new Map(inventoryRes.data?.map(i => [String(i.id), i]) || []);

      // Fetch shipment_items for each shipment
      const shipmentIds = shipmentsData?.map(s => s.id) || [];
      const { data: allShipmentItems } = await supabase
        .from('shipment_items')
        .select('*')
        .in('shipment_id', shipmentIds);

      // Create a map of shipment_id -> items[] with enriched data
      const shipmentItemsMap = new Map<string, ShipmentItem[]>();
      (allShipmentItems || []).forEach(item => {
        const shipmentId = String(item.shipment_id);
        if (!shipmentItemsMap.has(shipmentId)) {
          shipmentItemsMap.set(shipmentId, []);
        }

        // Enrich item with inventory data and delivery location
        const invItem = inventoryMap.get(String(item.inventory_item_id));
        const deliveryLocation = item.delivery_location_id ? locationsMap.get(String(item.delivery_location_id)) : null;

        shipmentItemsMap.get(shipmentId)!.push({
          ...item,
          item_name: invItem?.item_name || item.item_name || 'Unknown',
          inventory_item_id: String(item.inventory_item_id),
          delivery_location_name: deliveryLocation?.name, // Add delivery location name
        });
      });

      // Map the data manually
      const mappedShipments = (shipmentsData || []).map((shipment: any) => ({
        ...shipment,
        drivers: driversMap.get(String(shipment.driver_id)) || { name: 'Unknown' },
        vehicles: vehiclesMap.get(String(shipment.vehicle_id)) || { name: 'Unknown' },
        locations_origin: locationsMap.get(String(shipment.origin)) || { name: 'Unknown' },
        locations_destination: locationsMap.get(String(shipment.destination)) || { name: 'Unknown' },
        inventory: inventoryMap.get(String(shipment.inventory_item_id)) || { item_name: 'Unknown' },
        shipment_items: shipmentItemsMap.get(String(shipment.id)) || [],
      }));

      setShipments(mappedShipments);
      setIdleDrivers(idleDriversRes.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch active shipments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Refresh every 5 seconds for real-time updates
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Refetch when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      console.log('🔄 ActiveShipmentsList: Refresh trigger detected');
      fetchData();
    }
  }, [refreshTrigger]);

  const calculateProgress = (createdAt: string, arrivalTime: string): number => {
    const start = new Date(createdAt).getTime();
    const end = new Date(arrivalTime).getTime();
    const now = Date.now();

    if (now >= end) return 100;
    if (now <= start) return 0;

    const totalDuration = end - start;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  };

  const formatTimeRemaining = (arrivalTime: string): string => {
    const remaining = new Date(arrivalTime).getTime() - Date.now();
    if (remaining <= 0) return 'Arrived';

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleCancelShipment = async (shipment: ActiveShipment) => {
    console.log('Cancel button clicked for shipment:', shipment.id);

    if (!confirm(`Cancel shipment to ${shipment.locations_destination?.name}?\n\nThis will restore inventory and free up the driver/vehicle.`)) {
      console.log('User cancelled the confirmation dialog');
      return;
    }

    try {
      console.log('Starting cancellation process for shipment:', shipment.id);
      setError(null);

      // Update shipment status to Cancelled
      const { error: shipmentError, data: shipmentData } = await supabase
        .from('shipments')
        .update({ status: 'Cancelled' })
        .eq('id', shipment.id)
        .select();

      if (shipmentError) {
        console.error('❌ Shipment update error:', JSON.stringify(shipmentError, null, 2));
        throw new Error(`Failed to update shipment: ${shipmentError.message || JSON.stringify(shipmentError)}`);
      }
      console.log('✅ Shipment status updated to Cancelled:', shipmentData);

      // Set driver back to Idle
      const { error: driverError } = await supabase
        .from('drivers')
        .update({ status: 'Idle' })
        .eq('id', shipment.driver_id)
        .select();

      if (driverError) {
        console.error('❌ Driver update error:', JSON.stringify(driverError, null, 2));
        throw new Error(`Failed to update driver: ${driverError.message || JSON.stringify(driverError)}`);
      }
      console.log('✅ Driver status updated to Idle');

      // Set vehicle back to Idle
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({ status: 'Idle' })
        .eq('id', shipment.vehicle_id)
        .select();

      if (vehicleError) {
        console.error('❌ Vehicle update error:', JSON.stringify(vehicleError, null, 2));
        throw new Error(`Failed to update vehicle: ${vehicleError.message || JSON.stringify(vehicleError)}`);
      }
      console.log('✅ Vehicle status updated to Idle');

      // Return inventory - handle both single-item and multi-item shipments
      // Wrapped in try-catch to allow cancellation even if inventory restoration fails
      try {
        if (shipment.shipment_items && shipment.shipment_items.length > 0) {
        // Multi-item shipment - restore each item
        console.log('📦 Restoring multi-item shipment inventory...');
        for (const item of shipment.shipment_items) {
          const { data: inventoryData, error: inventoryFetchError } = await supabase
            .from('inventory')
            .select('quantity')
            .eq('id', item.inventory_item_id)
            .single();

          if (inventoryFetchError) {
            console.error('❌ Inventory fetch error for item:', item.item_name, inventoryFetchError);
            continue; // Skip this item but continue with others
          }

          if (inventoryData) {
            const newQuantity = inventoryData.quantity + item.quantity;
            const newStatus = newQuantity === 0 ? 'Out of Stock' : newQuantity < 10 ? 'Low Stock' : 'In Stock';

            const { error: inventoryUpdateError } = await supabase
              .from('inventory')
              .update({ quantity: newQuantity, status: newStatus })
              .eq('id', item.inventory_item_id);

            if (inventoryUpdateError) {
              console.error('❌ Inventory update error for item:', item.item_name, inventoryUpdateError);
            } else {
              console.log(`✅ Inventory updated: ${item.item_name} +${item.quantity} units, new quantity: ${newQuantity}`);
            }
          }
        }

        // Show success message for multi-item
        const totalItems = shipment.shipment_items.reduce((sum, item) => sum + item.quantity, 0);
        const cancelMessage = `Shipment cancelled. ${shipment.shipment_items.length} products (${totalItems} total units) returned to inventory.`;
        setSuccessMessage(cancelMessage);
        setTimeout(() => setSuccessMessage(null), 5000);

        addNotification(
          'cancel',
          'Shipment Cancelled',
          `${shipment.shipment_items.length} products to ${shipment.locations_destination?.name || 'destination'} cancelled`
        );

        showToast(
          'cancel',
          'Shipment Cancelled',
          `${totalItems} units returned to inventory`
        );
      } else if (shipment.inventory_item_id) {
        // Single-item shipment (legacy)
        console.log('📦 Restoring single-item shipment inventory...');
        const { data: inventoryData, error: inventoryFetchError } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('id', shipment.inventory_item_id)
          .single();

        if (inventoryFetchError) {
          console.error('❌ Inventory fetch error:', JSON.stringify(inventoryFetchError, null, 2));
          throw new Error(`Failed to fetch inventory: ${inventoryFetchError.message || JSON.stringify(inventoryFetchError)}`);
        }

        if (inventoryData) {
          const newQuantity = inventoryData.quantity + shipment.quantity;
          const newStatus = newQuantity === 0 ? 'Out of Stock' : newQuantity < 10 ? 'Low Stock' : 'In Stock';

          const { error: inventoryUpdateError } = await supabase
            .from('inventory')
            .update({ quantity: newQuantity, status: newStatus })
            .eq('id', shipment.inventory_item_id)
            .select();

          if (inventoryUpdateError) {
            console.error('❌ Inventory update error:', JSON.stringify(inventoryUpdateError, null, 2));
            throw new Error(`Failed to update inventory: ${inventoryUpdateError.message || JSON.stringify(inventoryUpdateError)}`);
          }
          console.log(`✅ Inventory updated: +${shipment.quantity} units, new quantity: ${newQuantity}`);
        }

        // Show success message for single-item
        const cancelMessage = `Shipment cancelled. ${shipment.quantity}x ${shipment.inventory?.item_name} returned to inventory.`;
        setSuccessMessage(cancelMessage);
        setTimeout(() => setSuccessMessage(null), 5000);

        addNotification(
          'cancel',
          'Shipment Cancelled',
          `${shipment.quantity}x ${shipment.inventory?.item_name} to ${shipment.locations_destination?.name || 'destination'} was cancelled`
        );

        showToast(
          'cancel',
          'Shipment Cancelled',
          `${shipment.quantity}x ${shipment.inventory?.item_name} returned to inventory`
        );
        } else {
          // No inventory to restore
          console.log('⚠️ No inventory items to restore');
          setSuccessMessage('Shipment cancelled.');
          setTimeout(() => setSuccessMessage(null), 5000);

          addNotification(
            'cancel',
            'Shipment Cancelled',
            `Shipment to ${shipment.locations_destination?.name || 'destination'} was cancelled`
          );

          showToast(
            'cancel',
            'Shipment Cancelled',
            'Shipment has been cancelled'
          );
        }
      } catch (inventoryError) {
        // Inventory restoration failed, but shipment is already cancelled
        console.error('⚠️ Inventory restoration failed, but shipment was cancelled:', inventoryError);
        setSuccessMessage('Shipment cancelled. Warning: Inventory may not have been restored correctly.');
        setTimeout(() => setSuccessMessage(null), 5000);

        addNotification(
          'cancel',
          'Shipment Cancelled',
          `Shipment cancelled (inventory restoration may have failed)`
        );

        showToast(
          'cancel',
          'Shipment Cancelled',
          'Check inventory manually'
        );
      }

      console.log('Shipment cancelled successfully');
      await fetchData();

      // Notify parent to refresh all components
      if (onShipmentChange) {
        onShipmentChange();
      }
    } catch (err) {
      console.error('Cancel shipment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel shipment');
    }
  };

  const handleSwapDriver = async (shipmentId: string, newDriverId: string) => {
    const shipment = shipments.find(s => s.id === shipmentId);
    if (!shipment) return;

    const oldDriverName = shipment.drivers?.name || 'Unknown';
    const newDriver = idleDrivers.find(d => String(d.id) === String(newDriverId));
    const newDriverName = newDriver?.name || 'Unknown';

    try {
      // Set old driver to Idle
      const { error: oldDriverError } = await supabase
        .from('drivers')
        .update({ status: 'Idle' })
        .eq('id', shipment.driver_id);

      if (oldDriverError) throw oldDriverError;

      // Set new driver to Busy
      const { error: newDriverError } = await supabase
        .from('drivers')
        .update({ status: 'Busy' })
        .eq('id', newDriverId);

      if (newDriverError) throw newDriverError;

      // Update shipment with new driver
      const { error: shipmentError } = await supabase
        .from('shipments')
        .update({ driver_id: newDriverId })
        .eq('id', shipmentId);

      if (shipmentError) throw shipmentError;

      // Add notification to sidebar
      addNotification(
        'swap',
        'Driver Swapped',
        `${shipment.quantity}x ${shipment.inventory?.item_name} to ${shipment.locations_destination?.name}: ${oldDriverName} → ${newDriverName}`
      );

      // Show toast notification
      showToast(
        'swap',
        'Driver Swapped Successfully',
        `${newDriverName} is now handling the shipment to ${shipment.locations_destination?.name}`
      );

      setSwappingShipmentId(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to swap driver');
    }
  };

  const handleFinishShipment = async (shipment: ActiveShipment) => {
    try {
      // Update shipment status to Delivered
      const { error: shipmentError } = await supabase
        .from('shipments')
        .update({ status: 'Delivered' })
        .eq('id', shipment.id);

      if (shipmentError) throw shipmentError;

      // Set driver back to Idle
      const { error: driverError } = await supabase
        .from('drivers')
        .update({ status: 'Idle' })
        .eq('id', shipment.driver_id);

      if (driverError) throw driverError;

      // Set vehicle back to Idle
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({ status: 'Idle' })
        .eq('id', shipment.vehicle_id);

      if (vehicleError) throw vehicleError;

      // === MULTI-ITEM INVENTORY TRANSFER LOGIC ===
      // Fetch all shipment_items with their delivery locations
      const { data: shipmentItems, error: itemsError } = await supabase
        .from('shipment_items')
        .select('*, locations:delivery_location_id(id, name)')
        .eq('shipment_id', shipment.id);

      if (itemsError) {
        console.error('Error fetching shipment items:', itemsError);
      }

      let totalItems = 0;
      const processedItems: string[] = [];
      const destinationSummary: { [key: string]: string[] } = {};

      // Process each item in the manifest
      if (shipmentItems && shipmentItems.length > 0) {
        for (const item of shipmentItems) {
          try {
            // Get the delivery location for THIS specific item
            const itemDestination = (item.locations as any)?.name;

            if (!itemDestination) {
              console.error(`No delivery location for item ${item.item_name}`);
              continue;
            }

            // Track items by destination for summary
            if (!destinationSummary[itemDestination]) {
              destinationSummary[itemDestination] = [];
            }

            // Check if item exists at THIS item's destination
            const { data: existingInventory, error: checkError } = await supabase
              .from('inventory')
              .select('*')
              .eq('location', itemDestination)
              .eq('item_name', item.item_name)
              .maybeSingle();

            if (checkError) {
              console.error(`Error checking inventory for ${item.item_name}:`, checkError);
              continue;
            }

            if (existingInventory) {
              // UPDATE: Item exists, increment quantity
              const newQuantity = existingInventory.quantity + item.quantity;
              const { error: updateError } = await supabase
                .from('inventory')
                .update({
                  quantity: newQuantity,
                  status: newQuantity > 0 ? 'In Stock' : 'Out of Stock'
                })
                .eq('id', existingInventory.id);

              if (updateError) {
                console.error(`❌ Failed to update inventory for ${item.item_name}:`, updateError);
                throw new Error(`Failed to update inventory: ${updateError.message}`);
              }

              console.log(`✅ Updated ${itemDestination}: ${item.item_name} +${item.quantity} (now ${newQuantity})`);
              totalItems += item.quantity;
              processedItems.push(`${item.quantity}x ${item.item_name}`);
              destinationSummary[itemDestination].push(`${item.quantity}x ${item.item_name}`);
            } else {
              // INSERT: Create new inventory item
              // Get original inventory details for price/sku
              const { data: originalInventory, error: fetchError } = await supabase
                .from('inventory')
                .select('price_per_unit, sku')
                .eq('id', item.inventory_item_id)
                .single();

              if (fetchError) {
                console.error(`❌ Failed to fetch original inventory for ${item.item_name}:`, fetchError);
              }

              const { error: insertError } = await supabase
                .from('inventory')
                .insert({
                  item_name: item.item_name,
                  quantity: item.quantity,
                  location: itemDestination,
                  status: 'In Stock',
                  price_per_unit: originalInventory?.price_per_unit || item.price_per_unit || 0,
                  sku: originalInventory?.sku || `SKU-${Date.now()}`,
                });

              if (insertError) {
                console.error(`❌ Failed to insert inventory for ${item.item_name}:`, insertError);
                throw new Error(`Failed to insert inventory: ${insertError.message}`);
              }

              console.log(`✅ Created ${itemDestination}: ${item.item_name} (${item.quantity} units)`);
              totalItems += item.quantity;
              processedItems.push(`${item.quantity}x ${item.item_name}`);
              destinationSummary[itemDestination].push(`${item.quantity}x ${item.item_name}`);
            }
          } catch (itemErr) {
            console.error(`Error processing item ${item.item_name}:`, itemErr);
          }
        }
      }

      // Create summary message
      const itemsSummary = processedItems.length === 1
        ? processedItems[0]
        : `${processedItems.length} items (${totalItems} total units)`;

      // Create multi-destination summary
      const destinationList = Object.entries(destinationSummary)
        .map(([dest, items]) => `${dest}: ${items.join(', ')}`)
        .join(' | ');

      const destinationCount = Object.keys(destinationSummary).length;
      const notificationMessage = destinationCount > 1
        ? `${itemsSummary} delivered to ${destinationCount} locations: ${destinationList}`
        : `${itemsSummary} arrived at ${Object.keys(destinationSummary)[0]}`;

      // Add notification to sidebar
      addNotification(
        'arrival',
        'Shipment Arrived',
        `${notificationMessage}. ${shipment.drivers?.name} is now available.`
      );

      // Show toast notification
      showToast(
        'arrival',
        'Shipment Delivered!',
        `${shipment.drivers?.name} delivered ${itemsSummary} to ${destinationCount} location${destinationCount > 1 ? 's' : ''}`
      );

      await fetchData();

      // Notify parent to refresh all components
      if (onShipmentChange) {
        onShipmentChange();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finish shipment');
    }
  };

  const generateInvoice = (shipment: ActiveShipment) => {
    try {
      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('CargoPulse Logistics', 105, 20, { align: 'center' });

      doc.setFontSize(16);
      doc.text('Bill of Lading', 105, 30, { align: 'center' });

      // Shipment Details
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      const currentDate = new Date().toLocaleDateString();
      const createdDate = new Date(shipment.created_at).toLocaleDateString();

      doc.text(`Shipment ID: ${shipment.id}`, 20, 45);
      doc.text(`Date Issued: ${currentDate}`, 20, 52);
      doc.text(`Date Created: ${createdDate}`, 20, 59);

      doc.text(`Origin: ${shipment.locations_origin?.name || 'Unknown'}`, 20, 70);
      doc.text(`Destination: ${shipment.locations_destination?.name || 'Unknown'}`, 20, 77);

      doc.text(`Vehicle: ${shipment.vehicles?.name || 'Unknown'}`, 20, 88);
      doc.text(`${shipment.shipping_method === 'plane' ? 'Pilot' : 'Driver'}: ${shipment.drivers?.name || 'Unknown'}`, 20, 95);
      doc.text(`Shipping Method: ${shipment.shipping_method || 'standard'}`, 20, 102);
      doc.text(`Urgency: ${shipment.urgency || 'standard'}`, 20, 109);

      // Manifest Table
      const tableData: any[] = [];

      if (shipment.shipment_items && shipment.shipment_items.length > 0) {
        // Multi-item shipment
        shipment.shipment_items.forEach((item) => {
          tableData.push([
            item.item_name,
            item.quantity.toString(),
            `$${item.price_per_unit?.toFixed(2) || '0.00'}`,
            `$${item.total_cost?.toFixed(2) || '0.00'}`
          ]);
        });
      } else if (shipment.inventory?.item_name) {
        // Legacy single-item shipment
        const pricePerUnit = shipment.inventory?.price_per_unit || 0;
        const totalCost = shipment.total_cost || (pricePerUnit * shipment.quantity);

        tableData.push([
          shipment.inventory.item_name,
          shipment.quantity.toString(),
          `$${pricePerUnit.toFixed(2)}`,
          `$${totalCost.toFixed(2)}`
        ]);
      }

      autoTable(doc, {
        startY: 120,
        head: [['Item Name', 'Quantity', 'Price/Unit', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [59, 130, 246], // Blue
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 10,
        },
      });

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY || 150;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Cost: $${shipment.total_cost?.toFixed(2) || '0.00'}`, 20, finalY + 15);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Status: ${shipment.status}`, 20, finalY + 25);

      // Arrival time if available
      if (shipment.arrival_time) {
        const arrivalDate = new Date(shipment.arrival_time).toLocaleString();
        doc.text(`Expected Arrival: ${arrivalDate}`, 20, finalY + 32);
      }

      // Signature section
      doc.setFontSize(10);
      doc.text('_________________________________', 20, finalY + 50);
      doc.text('Authorized Signature', 20, finalY + 57);

      doc.text('_________________________________', 120, finalY + 50);
      doc.text('Date', 120, finalY + 57);

      // Save the PDF
      doc.save(`invoice-${shipment.id}.pdf`);

      // Show success toast
      showToast(
        'arrival',
        'Invoice Generated',
        `PDF invoice for shipment ${shipment.id} has been downloaded`
      );
    } catch (err) {
      console.error('Error generating invoice:', err);
      showToast(
        'cancel',
        'Error',
        'Failed to generate invoice PDF'
      );
    }
  };

  if (loading && shipments.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading active shipments...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Live Tracking</h2>
          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold">
            {shipments.length} Active
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="text-green-800 dark:text-green-200 text-sm font-medium">{successMessage}</p>
          </div>
        </div>
      )}

      {shipments.length === 0 ? (
        <div className="text-center py-12">
          <Truck className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No active shipments at the moment</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {shipments.map((shipment) => {
            const progress = calculateProgress(shipment.created_at, shipment.arrival_time);
            const timeRemaining = formatTimeRemaining(shipment.arrival_time);
            const isSwapping = swappingShipmentId === shipment.id;
            const isExpanded = expandedShipmentId === shipment.id;

            return (
              <div
                key={shipment.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg dark:hover:shadow-gray-900/50 transition-shadow cursor-pointer"
                onClick={() => setExpandedShipmentId(isExpanded ? null : shipment.id)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                      {shipment.shipping_method === 'plane' ? (
                        <Plane className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {shipment.vehicles?.name || 'Unknown Vehicle'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {shipment.shipping_method === 'plane' ? 'Pilot' : 'Driver'}: {shipment.drivers?.name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      shipment.urgency === 'express'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {shipment.urgency}
                    </span>
                  </div>
                </div>

                {/* Route Info */}
                <div className="flex items-center gap-2 mb-3 text-sm">
                  <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {shipment.locations_origin?.name}
                  </span>
                  <span className="text-gray-400 dark:text-gray-600">→</span>
                  <MapPin className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {shipment.locations_destination?.name}
                  </span>
                </div>

                {/* Cargo Info */}
                <div className="flex items-center gap-2 mb-3 text-sm">
                  <Package className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {shipment.shipment_items && shipment.shipment_items.length > 0 ? (
                      shipment.shipment_items.length === 1 ? (
                        `${shipment.shipment_items[0].quantity}x ${shipment.shipment_items[0].item_name}`
                      ) : (
                        `${shipment.shipment_items.length} items (${shipment.shipment_items.reduce((sum, item) => sum + item.quantity, 0)} units)`
                      )
                    ) : (
                      shipment.quantity && shipment.inventory?.item_name ? (
                        `${shipment.quantity}x ${shipment.inventory.item_name}`
                      ) : (
                        'No items'
                      )
                    )}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span>Progress</span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{timeRemaining}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-green-500 dark:from-blue-600 dark:to-green-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {progress.toFixed(1)}% complete
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Shipment ID:</span>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{shipment.id}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Created:</span>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">
                          {new Date(shipment.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Expected Arrival:</span>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">
                          {new Date(shipment.arrival_time).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Total Cost:</span>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">
                          ${shipment.total_cost?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>

                    {/* Manifest Details */}
                    {shipment.shipment_items && shipment.shipment_items.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Cargo Manifest:</h4>
                        <div className="space-y-1">
                          {shipment.shipment_items.map((item, idx) => (
                            <div key={idx} className="flex flex-col text-sm bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                              <div className="flex justify-between">
                                <span className="text-gray-700 dark:text-gray-300 font-medium">{item.item_name}</span>
                                <span className="text-gray-600 dark:text-gray-400">
                                  {item.quantity} units × ${item.price_per_unit?.toFixed(2)} = ${item.total_cost?.toFixed(2)}
                                </span>
                              </div>
                              {(item as any).delivery_location_name && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-blue-600 dark:text-blue-400">
                                  <MapPin className="w-3 h-3" />
                                  <span>Delivering to: {(item as any).delivery_location_name}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions - 2 Rows */}
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700 dark:bg-gray-800">
                  {!isSwapping ? (
                    <div className="flex flex-col gap-2">
                      {/* First Row */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            generateInvoice(shipment);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/50 text-sm transition-colors"
                          title="Download PDF invoice"
                        >
                          <FileText className="w-4 h-4" />
                          Invoice
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFinishShipment(shipment);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md hover:bg-green-100 dark:hover:bg-green-900/50 text-sm transition-colors"
                          title="Mark shipment as delivered"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Finish
                        </button>
                      </div>
                      {/* Second Row */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSwappingShipmentId(shipment.id);
                          }}
                          disabled={idleDrivers.length === 0 || shipment.shipping_method === 'plane'}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={shipment.shipping_method === 'plane' ? 'Cannot swap pilots during flight' : 'Swap driver to another available driver'}
                        >
                          <Users className="w-4 h-4" />
                          Swap Driver
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCancelShipment(shipment);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 text-sm transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 w-full">
                      <select
                        onChange={(e) => handleSwapDriver(shipment.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-700 dark:text-gray-100"
                      >
                        <option value="">Select new driver...</option>
                        {idleDrivers.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSwappingShipmentId(null);
                        }}
                        className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
