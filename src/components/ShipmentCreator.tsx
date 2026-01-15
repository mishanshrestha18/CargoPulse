'use client';

import { useState, useEffect } from 'react';
import { Truck, Plane, MapPin, Package, DollarSign, AlertCircle, Send, Plus, X, List } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Inventory, Location, Vehicle, Driver, ShipmentInsert, ShipmentItemInsert } from '@/types/database';
import { useNotifications } from '@/contexts/NotificationContext';
import { showToast } from '@/components/ToastContainer';
import { getDistance } from 'geolib';

interface ManifestItem {
  inventoryItem: Inventory;
  quantity: number;
  productCost: number;
  discountPercent: number;
  discountedProductCost: number;
}

interface ShipmentForm {
  origin: string;
  destination: string;
  vehicleId: string;
  driverId: string;
  urgency: 'standard' | 'express';
  shippingMethod: 'truck' | 'plane';
}

interface PriceBreakdown {
  manifest: ManifestItem[];
  totalProductCost: number;
  totalDiscountedProductCost: number;
  distanceKm: number;
  durationSeconds: number;
  shippingCost: number;
  totalCost: number;
}

export default function ShipmentCreator() {
  const { addNotification } = useNotifications();
  const [locations, setLocations] = useState<Location[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  const [form, setForm] = useState<ShipmentForm>({
    origin: '',
    destination: '',
    vehicleId: '',
    driverId: '',
    urgency: 'standard',
    shippingMethod: 'truck',
  });

  // Manifest state (list of items to ship)
  const [manifest, setManifest] = useState<ManifestItem[]>([]);

  // Temporary state for adding new item to manifest
  const [newItem, setNewItem] = useState({
    inventoryItemId: '',
    quantity: 1,
  });

  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Load form from localStorage on mount
  useEffect(() => {
    const savedForm = localStorage.getItem('shipmentCreatorForm');
    if (savedForm) {
      try {
        const parsed = JSON.parse(savedForm);
        setForm(parsed.form || parsed);
        setManifest(parsed.manifest || []);
      } catch (err) {
        console.error('Failed to parse saved form:', err);
      }
    }
    fetchData();
  }, []);

  // Save form to localStorage whenever it changes
  useEffect(() => {
    if (form.origin || form.destination || manifest.length > 0) {
      localStorage.setItem('shipmentCreatorForm', JSON.stringify({ form, manifest }));
    }
  }, [form, manifest]);

  // Subscribe to inventory changes in real-time
  useEffect(() => {
    console.log('🔌 Setting up inventory real-time subscription');
    const channel = supabase
      .channel('inventory-changes-' + Math.random())
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
        },
        (payload) => {
          console.log('📦 Inventory changed via Realtime:', payload);
          fetchData().then(() => {
            setLastSyncTime(new Date());
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to inventory changes');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-detect shipping method based on location names
  useEffect(() => {
    if (!form.origin || !form.destination) {
      setForm(prev => ({ ...prev, shippingMethod: 'truck', vehicleId: '' }));
      return;
    }

    const originLoc = locations.find(loc => String(loc.id) === String(form.origin));
    const destLoc = locations.find(loc => String(loc.id) === String(form.destination));

    if (originLoc && destLoc) {
      const originName = originLoc.name.toLowerCase();
      const destName = destLoc.name.toLowerCase();

      const airKeywords = ['airport', 'air', 'international', 'port'];
      const isAirOrigin = airKeywords.some(keyword => originName.includes(keyword));
      const isAirDest = airKeywords.some(keyword => destName.includes(keyword));

      const shouldUsePlane = isAirOrigin || isAirDest;

      setForm(prev => ({
        ...prev,
        shippingMethod: shouldUsePlane ? 'plane' : 'truck',
        vehicleId: '',
      }));
    }
  }, [form.origin, form.destination, locations]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [locationsRes, vehiclesRes, driversRes, inventoryRes] = await Promise.all([
        supabase.from('locations').select('*').order('name'),
        supabase.from('vehicles').select('*').order('name'),
        supabase.from('drivers').select('*').eq('status', 'Idle').order('name'),
        supabase.from('inventory').select('*').order('item_name'),
      ]);

      if (locationsRes.error) throw locationsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (driversRes.error) throw driversRes.error;
      if (inventoryRes.error) throw inventoryRes.error;

      setLocations(locationsRes.data || []);
      setVehicles(vehiclesRes.data || []);
      setDrivers(driversRes.data || []);
      setInventory(inventoryRes.data || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate applicable discount based on quantity
  const calculateDiscount = (item: Inventory, quantity: number): number => {
    let discount = 0;

    if (item.discount_tier_3_qty && quantity >= item.discount_tier_3_qty) {
      discount = item.discount_tier_3_percent || 0;
    }
    else if (item.discount_tier_2_qty && quantity >= item.discount_tier_2_qty) {
      discount = item.discount_tier_2_percent || 0;
    }
    else if (item.discount_tier_1_qty && quantity >= item.discount_tier_1_qty) {
      discount = item.discount_tier_1_percent || 0;
    }

    return Math.min(discount, item.max_discount || 20);
  };

  // Calculate distance and duration using OSRM (for trucks)
  const calculateRoute = async (originLoc: Location, destLoc: Location): Promise<{ distanceKm: number; durationSeconds: number }> => {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLoc.longitude},${originLoc.latitude};${destLoc.longitude},${destLoc.latitude}?overview=false`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('Could not calculate route distance');
    }

    return {
      distanceKm: data.routes[0].distance / 1000,
      durationSeconds: data.routes[0].duration,
    };
  };

  // Recalculate pricing whenever form or manifest changes
  useEffect(() => {
    const calculatePricing = async () => {
      if (!form.origin || !form.destination || manifest.length === 0) {
        setPriceBreakdown(null);
        return;
      }

      const originLoc = locations.find(loc => String(loc.id) === String(form.origin));
      const destLoc = locations.find(loc => String(loc.id) === String(form.destination));

      if (!originLoc || !destLoc) return;

      try {
        setCalculating(true);

        let distanceKm: number;
        let durationSeconds: number;

        if (form.shippingMethod === 'truck') {
          // Use OSRM road routing for trucks
          const routeData = await calculateRoute(originLoc, destLoc);
          distanceKm = routeData.distanceKm;
          durationSeconds = routeData.durationSeconds;
        } else {
          // Use geodesic distance for airplanes
          const distanceMeters = getDistance(
            { latitude: originLoc.latitude, longitude: originLoc.longitude },
            { latitude: destLoc.latitude, longitude: destLoc.longitude }
          );
          distanceKm = distanceMeters / 1000;

          // Calculate duration based on air speed
          const airSpeed = form.urgency === 'express' ? 900 : 800; // km/h (express is faster)
          durationSeconds = (distanceKm / airSpeed) * 3600;
        }

        // Calculate total product cost from manifest
        let totalProductCost = 0;
        let totalDiscountedProductCost = 0;

        manifest.forEach(item => {
          totalProductCost += item.productCost;
          totalDiscountedProductCost += item.discountedProductCost;
        });

        // Calculate shipping cost
        const baseRate = form.shippingMethod === 'truck' ? 1.50 : 5.00;
        const urgencyMultiplier = form.urgency === 'express' ? 1.5 : 1;
        const shippingCost = distanceKm * baseRate * urgencyMultiplier;

        const totalCost = totalDiscountedProductCost + shippingCost;

        setPriceBreakdown({
          manifest,
          totalProductCost,
          totalDiscountedProductCost,
          distanceKm,
          durationSeconds,
          shippingCost,
          totalCost,
        });
      } catch (err) {
        console.error('Failed to calculate pricing:', err);
        setPriceBreakdown(null);
      } finally {
        setCalculating(false);
      }
    };

    calculatePricing();
  }, [form, manifest, locations]);

  // Add item to manifest
  const handleAddToManifest = () => {
    if (!newItem.inventoryItemId) {
      alert('Please select a product');
      return;
    }
    if (newItem.quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    const inventoryItem = inventory.find(item => String(item.id) === String(newItem.inventoryItemId));
    if (!inventoryItem) return;

    if (newItem.quantity > inventoryItem.quantity) {
      alert(`Quantity exceeds available stock (${inventoryItem.quantity} available)`);
      return;
    }

    // Check if item already in manifest
    const existingItem = manifest.find(m => String(m.inventoryItem.id) === String(newItem.inventoryItemId));
    if (existingItem) {
      alert('Product already in manifest. Remove it first to change quantity.');
      return;
    }

    // Calculate costs
    const productCost = inventoryItem.price_per_unit * newItem.quantity;
    const discountPercent = calculateDiscount(inventoryItem, newItem.quantity);
    const discountMultiplier = 1 - (discountPercent / 100);
    const discountedProductCost = productCost * discountMultiplier;

    const manifestItem: ManifestItem = {
      inventoryItem,
      quantity: newItem.quantity,
      productCost,
      discountPercent,
      discountedProductCost,
    };

    setManifest([...manifest, manifestItem]);

    // Reset form
    setNewItem({
      inventoryItemId: '',
      quantity: 1,
    });
  };

  const handleRemoveFromManifest = (inventoryItemId: string) => {
    setManifest(manifest.filter(m => String(m.inventoryItem.id) !== String(inventoryItemId)));
  };

  const handleUpdateManifestQuantity = (inventoryItemId: string, newQuantity: number) => {
    const inventoryItem = inventory.find(item => String(item.id) === String(inventoryItemId));
    if (!inventoryItem) return;

    if (newQuantity > inventoryItem.quantity) {
      return;
    }

    const productCost = inventoryItem.price_per_unit * newQuantity;
    const discountPercent = calculateDiscount(inventoryItem, newQuantity);
    const discountMultiplier = 1 - (discountPercent / 100);
    const discountedProductCost = productCost * discountMultiplier;

    setManifest(manifest.map(m =>
      String(m.inventoryItem.id) === String(inventoryItemId)
        ? { ...m, quantity: newQuantity, productCost, discountPercent, discountedProductCost }
        : m
    ));
  };

  const handleDispatch = async () => {
    console.log('🚀 Dispatch button clicked');

    if (!priceBreakdown) {
      console.log('❌ No price breakdown, aborting');
      return;
    }

    // Validations
    if (form.origin === form.destination) {
      alert('Origin and destination cannot be the same location');
      return;
    }

    if (manifest.length === 0) {
      alert('Please add at least one item to the manifest');
      return;
    }

    if (!form.driverId) {
      alert('Please select a driver for the shipment');
      return;
    }

    if (!form.vehicleId) {
      alert('Please select a vehicle for the shipment');
      return;
    }

    // Fetch latest inventory data
    console.log('🔄 Fetching latest inventory data before dispatch...');
    let latestInventory: Inventory[];
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('item_name');

      if (error) throw error;
      latestInventory = data || [];
      console.log('✅ Latest inventory fetched');
    } catch (err) {
      console.error('❌ Failed to fetch latest inventory:', err);
      alert('Failed to fetch latest inventory data. Please try again.');
      return;
    }

    // Validate all quantities against latest inventory
    console.log('📦 Validating manifest quantities...');
    for (const manifestItem of manifest) {
      const inventoryItem = latestInventory.find(item => String(item.id) === String(manifestItem.inventoryItem.id));

      if (!inventoryItem) {
        alert(`Product not found in inventory: ${manifestItem.inventoryItem.item_name}`);
        return;
      }
      if (manifestItem.quantity > inventoryItem.quantity) {
        console.error(`❌ QUANTITY EXCEEDED: ${inventoryItem.item_name}`);
        alert(`Cannot dispatch! ${inventoryItem.item_name} quantity exceeds available stock.\n\nRequested: ${manifestItem.quantity}\nAvailable: ${inventoryItem.quantity}`);
        return;
      }
    }
    console.log('✅ All quantities validated');

    try {
      setLoading(true);

      // Calculate arrival time
      const currentTime = new Date();
      const arrivalTime = new Date(currentTime.getTime() + priceBreakdown.durationSeconds * 1000);

      // Step 1: Create shipment record
      const shipmentToInsert: ShipmentInsert = {
        driver_id: form.driverId,
        vehicle_id: form.vehicleId,
        origin: form.origin,
        destination: form.destination,
        arrival_time: arrivalTime.toISOString(),
        status: 'In Transit',
        urgency: form.urgency,
        total_cost: priceBreakdown.totalCost,
        shipping_method: form.shippingMethod,
      };

      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipments')
        .insert([shipmentToInsert])
        .select()
        .single();

      if (shipmentError) throw shipmentError;
      console.log('✅ Shipment created:', shipmentData.id);

      // Step 2: Create shipment_items records
      const shipmentItemsToInsert: ShipmentItemInsert[] = manifest.map(manifestItem => ({
        shipment_id: shipmentData.id,
        inventory_item_id: manifestItem.inventoryItem.id,
        item_name: manifestItem.inventoryItem.item_name,
        quantity: manifestItem.quantity,
        price_per_unit: manifestItem.inventoryItem.price_per_unit,
        total_cost: manifestItem.discountedProductCost,
      }));

      const { error: itemsError } = await supabase
        .from('shipment_items')
        .insert(shipmentItemsToInsert);

      if (itemsError) throw itemsError;
      console.log(`✅ ${shipmentItemsToInsert.length} shipment items created`);

      // Step 3: Update inventory quantities for all items
      for (const manifestItem of manifest) {
        const inventoryItem = latestInventory.find(item => String(item.id) === String(manifestItem.inventoryItem.id));
        if (!inventoryItem) continue;

        const newQuantity = inventoryItem.quantity - manifestItem.quantity;
        const newStatus = newQuantity === 0 ? 'Out of Stock' : newQuantity < 10 ? 'Low Stock' : 'In Stock';

        console.log(`📦 Updating inventory for ${inventoryItem.item_name}: ${inventoryItem.quantity} -> ${newQuantity}`);

        const { error: inventoryError } = await supabase
          .from('inventory')
          .update({
            quantity: newQuantity,
            status: newStatus,
          })
          .eq('id', inventoryItem.id);

        if (inventoryError) throw inventoryError;
      }

      // Step 4: Update vehicle and driver status
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({ status: 'In Transit' })
        .eq('id', form.vehicleId);

      if (vehicleError) throw vehicleError;

      const { error: driverError } = await supabase
        .from('drivers')
        .update({ status: 'Busy' })
        .eq('id', form.driverId);

      if (driverError) throw driverError;

      // Get names for notifications
      const selectedDriver = drivers.find(d => String(d.id) === String(form.driverId));
      const driverName = selectedDriver ? selectedDriver.name : 'Driver';
      const originLoc = locations.find(l => String(l.id) === String(form.origin));
      const destLoc = locations.find(l => String(l.id) === String(form.destination));

      const itemsSummary = manifest.length === 1
        ? `${manifest[0].quantity} units of ${manifest[0].inventoryItem.item_name}`
        : `${manifest.length} items (${manifest.reduce((sum, m) => sum + m.quantity, 0)} total units)`;

      // Add notification
      addNotification(
        'dispatch',
        'Shipment Dispatched',
        `${itemsSummary} from ${originLoc?.name || 'origin'} to ${destLoc?.name || 'destination'} with ${driverName}`
      );

      // Show toast
      showToast(
        'dispatch',
        'Shipment Dispatched Successfully',
        `${driverName} is now en route to ${destLoc?.name || 'destination'}`
      );

      // Reset form
      setForm({
        origin: '',
        destination: '',
        vehicleId: '',
        driverId: '',
        urgency: 'standard',
        shippingMethod: 'truck',
      });
      setManifest([]);
      setNewItem({
        inventoryItemId: '',
        quantity: 1,
      });
      setPriceBreakdown(null);
      localStorage.removeItem('shipmentCreatorForm');

      // Refresh data
      await fetchData();
    } catch (err) {
      console.error('Failed to dispatch shipment:', err);
      alert(err instanceof Error ? err.message : 'Failed to dispatch shipment');
    } finally {
      setLoading(false);
    }
  };

  const isSameLocation = form.origin && form.destination && form.origin === form.destination;

  // Check if any manifest quantity exceeds available stock
  const hasQuantityError = manifest.some(manifestItem => {
    const invItem = inventory.find(item => String(item.id) === String(manifestItem.inventoryItem.id));
    return invItem && manifestItem.quantity > invItem.quantity;
  });

  // Filter vehicles by shipping method and status
  const filteredVehicles = vehicles.filter(v => {
    const vehicleType = (v.type || '').toLowerCase().trim();
    const shippingMethod = form.shippingMethod.toLowerCase();

    const isMatch =
      (shippingMethod === 'truck' && vehicleType !== 'plane') ||
      (shippingMethod === 'plane' && vehicleType === 'plane');

    return isMatch && v.status === 'Idle';
  });

  const handleClearForm = () => {
    if (confirm('Are you sure you want to clear the form and manifest?')) {
      setForm({
        origin: '',
        destination: '',
        vehicleId: '',
        driverId: '',
        urgency: 'standard',
        shippingMethod: 'truck',
      });
      setManifest([]);
      setNewItem({
        inventoryItemId: '',
        quantity: 1,
      });
      setPriceBreakdown(null);
      localStorage.removeItem('shipmentCreatorForm');
    }
  };

  if (loading && inventory.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading shipment creator...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Create Multi-Item Shipment</h2>
        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
          <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"></span>
          Live Sync {lastSyncTime && `(${lastSyncTime.toLocaleTimeString()})`}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Route & Manifest Builder */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wide">Route Details</h3>

          {/* Origin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Origin Location
            </label>
            <select
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">Select origin...</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.type})
                </option>
              ))}
            </select>
          </div>

          {/* Destination */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Destination Location
            </label>
            <select
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 dark:bg-gray-700 dark:text-gray-100 ${
                isSameLocation
                  ? 'border-red-500 focus:ring-red-500 dark:focus:ring-red-400'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400'
              }`}
            >
              <option value="">Select destination...</option>
              {locations.filter(loc => String(loc.id) !== String(form.origin)).map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.type})
                </option>
              ))}
            </select>
            {isSameLocation && (
              <p className="text-xs text-red-600 dark:text-red-400 font-semibold mt-1">
                Origin and destination cannot be the same
              </p>
            )}
          </div>

          {/* Shipping Method Display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Shipping Method
            </label>
            <div className={`p-3 rounded-lg border-2 ${
              form.shippingMethod === 'plane'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
            }`}>
              <div className="flex items-center gap-2">
                {form.shippingMethod === 'plane' ? (
                  <>
                    <Plane className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-blue-900 dark:text-blue-300">Air Freight</span>
                    <span className="text-xs text-blue-700 dark:text-blue-400">(800 km/h • $5.00/km)</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Ground Transport</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">(60 km/h • $1.50/km)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Vehicle Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {form.shippingMethod === 'plane' ? <Plane className="w-4 h-4 inline mr-1" /> : <Truck className="w-4 h-4 inline mr-1" />}
              Select {form.shippingMethod === 'plane' ? 'Aircraft' : 'Vehicle'}
            </label>
            <select
              value={form.vehicleId}
              onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">Select {form.shippingMethod}...</option>
              {filteredVehicles.map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name} - {vehicle.type} (Capacity: {vehicle.capacity})
                </option>
              ))}
            </select>
            {filteredVehicles.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No idle {form.shippingMethod}s available</p>
            )}
          </div>

          {/* Driver Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Truck className="w-4 h-4 inline mr-1" />
              Select {form.shippingMethod === 'plane' ? 'Pilot' : 'Driver'}
            </label>
            <select
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">Select {form.shippingMethod === 'plane' ? 'pilot' : 'driver'}...</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} {driver.phone ? `- ${driver.phone}` : ''}
                </option>
              ))}
            </select>
            {drivers.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No idle {form.shippingMethod === 'plane' ? 'pilots' : 'drivers'} available</p>
            )}
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Shipping Urgency
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="standard"
                  checked={form.urgency === 'standard'}
                  onChange={(e) => setForm({ ...form, urgency: e.target.value as 'standard' | 'express' })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-900 dark:text-gray-100">Standard (1x)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="express"
                  checked={form.urgency === 'express'}
                  onChange={(e) => setForm({ ...form, urgency: e.target.value as 'standard' | 'express' })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-900 dark:text-gray-100">Express (1.5x)</span>
              </label>
            </div>
          </div>

          {/* Manifest Builder */}
          <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <List className="w-4 h-4 inline mr-1" />
              Build Cargo Manifest
            </label>

            <div className="space-y-3">
              {/* Product selector */}
              <select
                value={newItem.inventoryItemId}
                onChange={(e) => setNewItem({ ...newItem, inventoryItemId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                disabled={!form.origin}
              >
                <option value="">Select product...</option>
                {inventory
                  .filter(item => {
                    if (!form.origin) return false;
                    const selectedOriginLocation = locations.find(loc => String(loc.id) === String(form.origin));
                    if (!selectedOriginLocation) return false;

                    const itemBelongsToOrigin = String(item.location).trim().toLowerCase() === String(selectedOriginLocation.name).trim().toLowerCase();
                    const hasQuantity = item.quantity > 0;
                    const notAlreadyAdded = !manifest.some(m => String(m.inventoryItem.id) === String(item.id));
                    return itemBelongsToOrigin && hasQuantity && notAlreadyAdded;
                  })
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.item_name} - Available: {item.quantity} units @ ${item.price_per_unit.toFixed(2)}
                    </option>
                  ))}
              </select>

              {/* Quantity input */}
              <div className="space-y-1">
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={newItem.quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || val === '0') {
                        setNewItem({ ...newItem, quantity: 0 });
                      } else {
                        const numVal = parseInt(val, 10);
                        if (!isNaN(numVal) && numVal > 0) {
                          setNewItem({ ...newItem, quantity: numVal });
                        }
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 dark:bg-gray-700 dark:text-gray-100 ${
                      newItem.inventoryItemId && newItem.quantity > 0 &&
                      inventory.find(item => String(item.id) === String(newItem.inventoryItemId))?.quantity < newItem.quantity
                        ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-400'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400'
                    }`}
                    placeholder="Quantity"
                    disabled={!form.origin}
                  />
                  <button
                    type="button"
                    onClick={handleAddToManifest}
                    disabled={!newItem.inventoryItemId || !form.origin}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    Add to Load
                  </button>
                </div>

                {/* Inline validation messages */}
                {!form.origin && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Please select an origin location first
                  </p>
                )}
                {form.origin && newItem.inventoryItemId && newItem.quantity > 0 && (() => {
                  const selectedItem = inventory.find(item => String(item.id) === String(newItem.inventoryItemId));
                  if (selectedItem && newItem.quantity > selectedItem.quantity) {
                    return (
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                        ⚠️ Quantity exceeds available stock ({selectedItem.quantity} available)
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Manifest List */}
            {manifest.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Cargo Manifest ({manifest.length} items, {manifest.reduce((sum, m) => sum + m.quantity, 0)} total units):
                </h4>
                {manifest.map((manifestItem) => {
                  const invItem = inventory.find(item => String(item.id) === String(manifestItem.inventoryItem.id));
                  const isQuantityExceeded = invItem && manifestItem.quantity > invItem.quantity;

                  return (
                    <div key={manifestItem.inventoryItem.id} className={`flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded border ${isQuantityExceeded ? 'border-red-500 dark:border-red-600' : 'border-gray-200 dark:border-gray-600'}`}>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{manifestItem.inventoryItem.item_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">
                          ${manifestItem.inventoryItem.price_per_unit.toFixed(2)}/unit • Available: {invItem?.quantity || 0}
                          {manifestItem.discountPercent > 0 && (
                            <span className="text-green-600 dark:text-green-400 ml-2">
                              {manifestItem.discountPercent}% discount applied
                            </span>
                          )}
                        </p>
                        {isQuantityExceeded && (
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
                            ⚠️ Quantity exceeds available stock ({invItem?.quantity || 0} available)
                          </p>
                        )}
                      </div>
                      <input
                        type="number"
                        min="1"
                        max={invItem?.quantity || 0}
                        value={manifestItem.quantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val && val !== '0') {
                            const numVal = parseInt(val, 10);
                            if (!isNaN(numVal) && numVal > 0) {
                              handleUpdateManifestQuantity(manifestItem.inventoryItem.id, numVal);
                            }
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        className={`w-20 px-2 py-1 border rounded text-sm text-gray-900 dark:bg-gray-700 dark:text-gray-100 ${isQuantityExceeded ? 'border-red-500 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFromManifest(manifestItem.inventoryItem.id)}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Remove from manifest"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Clear Form Button */}
          {(manifest.length > 0 || form.origin || form.destination) && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 dark:bg-gray-800">
              <button
                onClick={handleClearForm}
                className="w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:text-white hover:bg-red-600 dark:hover:bg-red-700 border border-red-600 dark:border-red-400 rounded-md transition-colors font-medium"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Pricing Breakdown */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wide">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Cost Breakdown
          </h3>

          {calculating && (
            <div className="flex items-center justify-center py-12 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400 text-sm">Calculating pricing...</span>
            </div>
          )}

          {!calculating && priceBreakdown && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 border border-blue-200 dark:border-gray-600 rounded-lg p-6 space-y-3">
              {/* Manifest Breakdown */}
              <div className="space-y-2 pb-3 border-b border-blue-200 dark:border-gray-600">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Cargo Manifest:</h4>
                {priceBreakdown.manifest.map((item, idx) => (
                  <div key={idx} className="space-y-1 pl-2 border-l-2 border-blue-300 dark:border-blue-600">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {item.inventoryItem.item_name}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {item.quantity} × ${item.inventoryItem.price_per_unit.toFixed(2)} = ${item.productCost.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {item.discountPercent > 0 && (
                      <div className="flex justify-between items-center text-xs text-green-700 dark:text-green-400">
                        <span>Discount ({item.discountPercent}%)</span>
                        <span className="font-medium">
                          -${(item.productCost - item.discountedProductCost).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-700 dark:text-gray-300">Subtotal:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        ${item.discountedProductCost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Product Cost */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700 dark:text-gray-300">Total Product Cost</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  ${priceBreakdown.totalProductCost.toFixed(2)}
                </span>
              </div>

              {priceBreakdown.totalProductCost > priceBreakdown.totalDiscountedProductCost && (
                <>
                  <div className="flex justify-between items-center text-green-700 dark:text-green-400">
                    <span className="text-sm">Total Savings</span>
                    <span className="text-sm font-medium">
                      -${(priceBreakdown.totalProductCost - priceBreakdown.totalDiscountedProductCost).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-blue-200 dark:border-gray-600">
                    <span className="text-sm text-gray-700 dark:text-gray-300">After Discounts</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      ${priceBreakdown.totalDiscountedProductCost.toFixed(2)}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Distance ({form.shippingMethod === 'plane' ? 'Direct' : 'Road'})
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {priceBreakdown.distanceKm.toFixed(1)} km
                </span>
              </div>

              <div className="flex justify-between items-center pb-3 border-b border-blue-200 dark:border-gray-600">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Shipping Cost ({form.urgency === 'express' ? 'Express' : 'Standard'})
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  ${priceBreakdown.shippingCost.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
                <span>Estimated Delivery Time</span>
                <span>{(priceBreakdown.durationSeconds / 3600).toFixed(1)} hours</span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Total Cost</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ${priceBreakdown.totalCost.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {!calculating && !priceBreakdown && (
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-6 text-center">
              <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add items to manifest to see pricing
              </p>
            </div>
          )}

          {/* Dispatch Button */}
          <button
            onClick={handleDispatch}
            disabled={!priceBreakdown || isSameLocation || loading || !form.vehicleId || !form.driverId || manifest.length === 0 || hasQuantityError}
            className="w-full bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-colors"
            title={hasQuantityError ? 'Cannot dispatch - quantities exceed available stock' : ''}
          >
            <Send className="w-5 h-5" />
            Dispatch Shipment
          </button>

          {hasQuantityError && (
            <p className="text-xs text-red-600 dark:text-red-400 text-center font-semibold">
              ⚠️ Cannot dispatch - quantities exceed available stock
            </p>
          )}

          {!hasQuantityError && (!form.vehicleId || !form.driverId || manifest.length === 0) && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
              {manifest.length === 0 && 'Please add items to the manifest'}
              {manifest.length > 0 && !form.vehicleId && !form.driverId && `Please select a ${form.shippingMethod} and ${form.shippingMethod === 'plane' ? 'pilot' : 'driver'}`}
              {manifest.length > 0 && !form.vehicleId && form.driverId && `Please select a ${form.shippingMethod}`}
              {manifest.length > 0 && form.vehicleId && !form.driverId && `Please select a ${form.shippingMethod === 'plane' ? 'pilot' : 'driver'}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
