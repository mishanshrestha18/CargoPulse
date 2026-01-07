'use client';

import { useState, useEffect } from 'react';
import { Truck, Plane, MapPin, Package, DollarSign, AlertCircle, Send, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Inventory, Location, Vehicle, Driver, ShipmentInsert } from '@/types/database';
import { useNotifications } from '@/contexts/NotificationContext';
import { showToast } from '@/components/ToastContainer';

interface ProductItem {
  inventoryItemId: string;
  quantity: number;
}

interface ShipmentForm {
  origin: string;
  destination: string;
  vehicleId: string;
  driverId: string;
  products: ProductItem[];
  urgency: 'standard' | 'express';
  shippingMethod: 'truck' | 'plane';
}

interface ProductBreakdown {
  inventoryItem: Inventory;
  quantity: number;
  productCost: number;
  discountPercent: number;
  discountedProductCost: number;
}

interface PriceBreakdown {
  products: ProductBreakdown[];
  totalProductCost: number;
  totalDiscountedProductCost: number;
  distanceKm: number;
  durationSeconds: number;
  shippingCost: number;
  totalCost: number;
}

// Haversine formula to calculate straight-line distance between two coordinates
const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default function ShipmentCreator() {
  const { addNotification } = useNotifications();
  const [locations, setLocations] = useState<Location[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<ShipmentForm>({
    origin: '',
    destination: '',
    vehicleId: '',
    driverId: '',
    products: [],
    urgency: 'standard',
    shippingMethod: 'truck',
  });

  // Temporary state for adding new product
  const [newProduct, setNewProduct] = useState({
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
        setForm(parsed);
      } catch (err) {
        console.error('Failed to parse saved form:', err);
      }
    }
    fetchData();
  }, []);

  // Save form to localStorage whenever it changes
  useEffect(() => {
    if (form.origin || form.destination || form.products.length > 0) {
      localStorage.setItem('shipmentCreatorForm', JSON.stringify(form));
    }
  }, [form]);

  // Subscribe to inventory changes in real-time
  useEffect(() => {
    console.log('🔌 Setting up inventory real-time subscription');
    const channel = supabase
      .channel('inventory-changes-' + Math.random()) // Unique channel name per tab
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
        },
        (payload) => {
          console.log('📦 Inventory changed via Realtime (cross-tab):', payload);
          console.log('Event type:', payload.eventType);
          console.log('Changed item:', payload.new || payload.old);
          console.log('Current inventory state before refetch:', inventory.length, 'items');

          // Refetch inventory data to get the latest quantities
          fetchData().then(() => {
            setLastSyncTime(new Date());
            console.log('✅ Inventory data refetched after Realtime update');
            console.log('Updated inventory state:', inventory.length, 'items');
          });
        }
      )
      .subscribe((status) => {
        console.log('Inventory subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to inventory changes');
        }
      });

    return () => {
      console.log('🔌 Cleaning up inventory subscription');
      supabase.removeChannel(channel);
    };
  }, []); // Empty deps - subscribe once on mount, unsubscribe on unmount

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

      // Check if location names contain air-related keywords
      const airKeywords = ['airport', 'air', 'international', 'port'];
      const isAirOrigin = airKeywords.some(keyword => originName.includes(keyword));
      const isAirDest = airKeywords.some(keyword => destName.includes(keyword));

      // If either location is air-related, use plane
      const shouldUsePlane = isAirOrigin || isAirDest;

      setForm(prev => ({
        ...prev,
        shippingMethod: shouldUsePlane ? 'plane' : 'truck',
        vehicleId: '', // Reset vehicle selection when method changes
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
        // Don't filter by quantity > 0 so we can show items that were just reduced to 0
        supabase.from('inventory').select('*').order('item_name'),
      ]);

      if (locationsRes.error) throw locationsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (driversRes.error) throw driversRes.error;
      if (inventoryRes.error) throw inventoryRes.error;

      const newInventory = inventoryRes.data || [];
      console.log('📊 Fetched inventory:', newInventory.map(i => `${i.item_name}: ${i.quantity}`));

      setLocations(locationsRes.data || []);
      setVehicles(vehiclesRes.data || []);
      setDrivers(driversRes.data || []);
      setInventory(newInventory);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate applicable discount based on quantity
  const calculateDiscount = (item: Inventory, quantity: number): number => {
    let discount = 0;

    // Check tier 3 first (highest quantity)
    if (item.discount_tier_3_qty && quantity >= item.discount_tier_3_qty) {
      discount = item.discount_tier_3_percent || 0;
    }
    // Check tier 2
    else if (item.discount_tier_2_qty && quantity >= item.discount_tier_2_qty) {
      discount = item.discount_tier_2_percent || 0;
    }
    // Check tier 1
    else if (item.discount_tier_1_qty && quantity >= item.discount_tier_1_qty) {
      discount = item.discount_tier_1_percent || 0;
    }

    // Ensure discount doesn't exceed max_discount
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

    // Return distance in kilometers and duration in seconds
    return {
      distanceKm: data.routes[0].distance / 1000,
      durationSeconds: data.routes[0].duration,
    };
  };

  // Recalculate pricing whenever form changes
  useEffect(() => {
    const calculatePricing = async () => {
      if (!form.origin || !form.destination || form.products.length === 0) {
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
          // Use OSRM for road distance
          const routeData = await calculateRoute(originLoc, destLoc);
          distanceKm = routeData.distanceKm;
          durationSeconds = routeData.durationSeconds;
        } else {
          // Use Haversine for straight-line distance (air freight)
          distanceKm = calculateHaversineDistance(
            originLoc.latitude,
            originLoc.longitude,
            destLoc.latitude,
            destLoc.longitude
          );
          // Plane speed: 800 km/h
          durationSeconds = (distanceKm / 800) * 3600;
        }

        // Calculate cost for each product
        const productBreakdowns: ProductBreakdown[] = [];
        let totalProductCost = 0;
        let totalDiscountedProductCost = 0;

        for (const productItem of form.products) {
          const inventoryItem = inventory.find(item => String(item.id) === String(productItem.inventoryItemId));
          if (!inventoryItem) continue;

          const productCost = inventoryItem.price_per_unit * productItem.quantity;
          const discountPercent = calculateDiscount(inventoryItem, productItem.quantity);
          const discountMultiplier = 1 - (discountPercent / 100);
          const discountedProductCost = productCost * discountMultiplier;

          productBreakdowns.push({
            inventoryItem,
            quantity: productItem.quantity,
            productCost,
            discountPercent,
            discountedProductCost,
          });

          totalProductCost += productCost;
          totalDiscountedProductCost += discountedProductCost;
        }

        // Calculate shipping cost (one-time cost for the entire shipment)
        // Truck: $1.50/km, Plane: $5.00/km
        const baseRate = form.shippingMethod === 'truck' ? 1.50 : 5.00;
        const urgencyMultiplier = form.urgency === 'express' ? 1.5 : 1;
        const shippingCost = distanceKm * baseRate * urgencyMultiplier;

        // Total cost
        const totalCost = totalDiscountedProductCost + shippingCost;

        setPriceBreakdown({
          products: productBreakdowns,
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
  }, [form, inventory, locations]);

  const handleDispatch = async () => {
    console.log('🚀 Dispatch button clicked');

    if (!priceBreakdown) {
      console.log('❌ No price breakdown, aborting');
      return;
    }

    // Validate origin and destination are different
    if (form.origin === form.destination) {
      alert('Origin and destination cannot be the same location');
      return;
    }

    // Validate products exist
    if (form.products.length === 0) {
      alert('Please add at least one product to the shipment');
      return;
    }

    // Validate driver is selected
    if (!form.driverId) {
      alert('Please select a driver for the shipment');
      return;
    }

    // Validate vehicle is selected
    if (!form.vehicleId) {
      alert('Please select a vehicle for the shipment');
      return;
    }

    // CRITICAL: Fetch latest inventory data RIGHT BEFORE dispatching
    console.log('🔄 Fetching latest inventory data before dispatch...');
    let latestInventory: Inventory[];
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('item_name');

      if (error) throw error;
      latestInventory = data || [];
      console.log('✅ Latest inventory fetched:', latestInventory.map(i => `${i.item_name}: ${i.quantity}`));
    } catch (err) {
      console.error('❌ Failed to fetch latest inventory:', err);
      alert('Failed to fetch latest inventory data. Please try again.');
      return;
    }

    // Validate all product quantities against LATEST inventory - THIS IS CRITICAL
    console.log('📦 Validating product quantities against latest inventory...');
    for (const productItem of form.products) {
      const inventoryItem = latestInventory.find(item => String(item.id) === String(productItem.inventoryItemId));
      console.log(`Checking ${inventoryItem?.item_name}: requested=${productItem.quantity}, available=${inventoryItem?.quantity}`);

      if (!inventoryItem) {
        alert(`Product not found in inventory`);
        return;
      }
      if (productItem.quantity > inventoryItem.quantity) {
        console.error(`❌ QUANTITY EXCEEDED: ${inventoryItem.item_name} - requested ${productItem.quantity}, but only ${inventoryItem.quantity} available`);
        alert(`Cannot dispatch! Quantity for ${inventoryItem.item_name} exceeds available stock.\n\nRequested: ${productItem.quantity}\nAvailable: ${inventoryItem.quantity}\n\nInventory was just updated. Please refresh and try again.`);
        return;
      }
    }
    console.log('✅ All quantities validated successfully against latest inventory');

    try {
      setLoading(true);

      // Calculate arrival time = Current Time + Route Duration
      const currentTime = new Date();
      const arrivalTime = new Date(currentTime.getTime() + priceBreakdown.durationSeconds * 1000);

      // Create shipment records (one per product) and update inventory
      const shipmentsToInsert: ShipmentInsert[] = [];

      for (const breakdown of priceBreakdown.products) {
        const productItem = form.products.find(p => String(p.inventoryItemId) === String(breakdown.inventoryItem.id));
        if (!productItem) continue;

        // Create shipment record for this product
        shipmentsToInsert.push({
          driver_id: form.driverId,
          vehicle_id: form.vehicleId,
          origin: form.origin,
          destination: form.destination,
          inventory_item_id: breakdown.inventoryItem.id,
          quantity: productItem.quantity,
          arrival_time: arrivalTime.toISOString(),
          status: 'In Transit',
          urgency: form.urgency,
          total_cost: breakdown.discountedProductCost + (priceBreakdown.shippingCost / form.products.length), // Split shipping cost
          shipping_method: form.shippingMethod,
        });
      }

      // Insert all shipments
      const { error: shipmentError } = await supabase
        .from('shipments')
        .insert(shipmentsToInsert);

      if (shipmentError) throw shipmentError;

      // Update inventory quantities for all products using LATEST inventory data
      for (const productItem of form.products) {
        const inventoryItem = latestInventory.find(item => String(item.id) === String(productItem.inventoryItemId));
        if (!inventoryItem) continue;

        const newQuantity = inventoryItem.quantity - productItem.quantity;
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

      // Update vehicle status to In Transit
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({ status: 'In Transit' })
        .eq('id', form.vehicleId);

      if (vehicleError) throw vehicleError;

      // Update driver status to Busy
      const { error: driverError } = await supabase
        .from('drivers')
        .update({ status: 'Busy' })
        .eq('id', form.driverId);

      if (driverError) throw driverError;

      // Get driver and location names for success message
      const selectedDriver = drivers.find(d => String(d.id) === String(form.driverId));
      const driverName = selectedDriver ? selectedDriver.name : 'Driver';
      const originLoc = locations.find(l => String(l.id) === String(form.origin));
      const destLoc = locations.find(l => String(l.id) === String(form.destination));

      const productSummary = form.products.length === 1
        ? `${form.products[0].quantity} units of ${priceBreakdown.products[0].inventoryItem.item_name}`
        : `${form.products.length} products (${form.products.reduce((sum, p) => sum + p.quantity, 0)} total units)`;

      const methodLabel = form.shippingMethod === 'plane' ? '✈️ Air Freight' : '🚚 Ground Transport';
      const successMessage = `${methodLabel} shipment dispatched successfully! ${productSummary} sent with ${driverName}. ETA: ${arrivalTime.toLocaleString()}. Total cost: $${priceBreakdown.totalCost.toFixed(2)}`;

      setSuccess(successMessage);

      // Add notification to sidebar
      addNotification(
        'dispatch',
        'Shipment Dispatched',
        `${productSummary} from ${originLoc?.name || 'origin'} to ${destLoc?.name || 'destination'} with ${driverName}`
      );

      // Show toast notification
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
        products: [],
        urgency: 'standard',
        shippingMethod: 'truck',
      });
      setPriceBreakdown(null);

      // Clear localStorage
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

  // Check if any product quantity exceeds available stock
  const hasQuantityError = form.products.some(productItem => {
    const invItem = inventory.find(item => String(item.id) === String(productItem.inventoryItemId));
    return invItem && productItem.quantity > invItem.quantity;
  });

  // Helper functions for product management
  const handleAddProduct = () => {
    if (!newProduct.inventoryItemId) {
      alert('Please select a product');
      return;
    }
    if (newProduct.quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    const inventoryItem = inventory.find(item => String(item.id) === String(newProduct.inventoryItemId));
    if (!inventoryItem) return;

    if (newProduct.quantity > inventoryItem.quantity) {
      alert(`Quantity exceeds available stock (${inventoryItem.quantity} available)`);
      return;
    }

    // Check if product already added
    const existingProduct = form.products.find(p => String(p.inventoryItemId) === String(newProduct.inventoryItemId));
    if (existingProduct) {
      alert('Product already added. Remove it first to change quantity.');
      return;
    }

    setForm({
      ...form,
      products: [...form.products, { ...newProduct }],
    });

    // Reset newProduct form
    setNewProduct({
      inventoryItemId: '',
      quantity: 1,
    });
  };

  const handleRemoveProduct = (inventoryItemId: string) => {
    setForm({
      ...form,
      products: form.products.filter(p => String(p.inventoryItemId) !== String(inventoryItemId)),
    });
  };

  const handleUpdateProductQuantity = (inventoryItemId: string, newQuantity: number) => {
    const inventoryItem = inventory.find(item => String(item.id) === String(inventoryItemId));
    if (!inventoryItem) return;

    // Don't show alert - inline errors will show the issue
    if (newQuantity > inventoryItem.quantity) {
      return;
    }

    setForm({
      ...form,
      products: form.products.map(p =>
        String(p.inventoryItemId) === String(inventoryItemId)
          ? { ...p, quantity: newQuantity }
          : p
      ),
    });
  };

  // Filter vehicles by shipping method and status
  // Strategy: Use exact type matching based on table membership
  // Fleet table: all vehicles that are NOT type='plane'
  // Airplanes table: all vehicles with type='plane'
  const filteredVehicles = vehicles.filter(v => {
    const vehicleType = (v.type || '').toLowerCase().trim();
    const shippingMethod = form.shippingMethod.toLowerCase();

    const isMatch =
      (shippingMethod === 'truck' && vehicleType !== 'plane') ||
      (shippingMethod === 'plane' && vehicleType === 'plane');

    return isMatch && v.status === 'Idle';
  });

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

  const handleClearForm = () => {
    if (confirm('Are you sure you want to clear the form? This will remove all entered data.')) {
      setForm({
        origin: '',
        destination: '',
        vehicleId: '',
        driverId: '',
        products: [],
        urgency: 'standard',
        shippingMethod: 'truck',
      });
      setNewProduct({
        inventoryItemId: '',
        quantity: 1,
      });
      setPriceBreakdown(null);
      localStorage.removeItem('shipmentCreatorForm');
      setSuccess(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Create New Shipment</h2>
        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded" title={lastSyncTime ? `Last synced: ${lastSyncTime.toLocaleTimeString()}` : 'Waiting for changes...'}>
          <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"></span>
          Live Sync {lastSyncTime && `(${lastSyncTime.toLocaleTimeString()})`}
        </span>
      </div>

      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <p className="text-green-800 dark:text-green-200 text-sm">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Shipment Details */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wide">Shipment Details</h3>

          {/* Origin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Origin Location
            </label>
            <select
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
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
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
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
                Origin and destination cannot be the same location
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
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

          {/* Add Products Section */}
          <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <Package className="w-4 h-4 inline mr-1" />
              Add Products
            </label>

            <div className="space-y-3">
              {/* Product selector */}
              <select
                value={newProduct.inventoryItemId}
                onChange={(e) => setNewProduct({ ...newProduct, inventoryItemId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">Select product...</option>
                {inventory
                  .filter(item => item.quantity > 0 && !form.products.some(p => String(p.inventoryItemId) === String(item.id)))
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.item_name} - Available: {item.quantity} units @ ${item.price_per_unit.toFixed(2)}
                    </option>
                  ))}
              </select>

              {/* Quantity input */}
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={newProduct.quantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || val === '0') {
                      setNewProduct({ ...newProduct, quantity: 0 });
                    } else {
                      const numVal = parseInt(val, 10);
                      if (!isNaN(numVal) && numVal > 0) {
                        setNewProduct({ ...newProduct, quantity: numVal });
                      }
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Quantity"
                />
                <button
                  type="button"
                  onClick={handleAddProduct}
                  disabled={!newProduct.inventoryItemId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {/* Added products list */}
            {form.products.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected Products ({form.products.length}):</h4>
                {form.products.map((productItem) => {
                  const invItem = inventory.find(item => String(item.id) === String(productItem.inventoryItemId));
                  if (!invItem) return null;

                  const isQuantityExceeded = productItem.quantity > invItem.quantity;

                  // Debug logging
                  if (isQuantityExceeded) {
                    console.log(`⚠️ Quantity exceeded for ${invItem.item_name}: requested=${productItem.quantity}, available=${invItem.quantity}`);
                  }

                  return (
                    <div key={productItem.inventoryItemId} className={`flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded border ${isQuantityExceeded ? 'border-red-500 dark:border-red-600' : 'border-gray-200 dark:border-gray-600'}`}>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{invItem.item_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ${invItem.price_per_unit.toFixed(2)}/unit • Available: {invItem.quantity}
                        </p>
                        {isQuantityExceeded && (
                          <p className="text-xs text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Quantity exceeds available stock! (Requested: {productItem.quantity}, Available: {invItem.quantity})
                          </p>
                        )}
                      </div>
                      <input
                        type="number"
                        min="1"
                        max={invItem.quantity}
                        value={productItem.quantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || val === '0') {
                            // Allow empty/0 temporarily during editing
                            handleUpdateProductQuantity(productItem.inventoryItemId, 1);
                          } else {
                            const numVal = parseInt(val, 10);
                            if (!isNaN(numVal) && numVal > 0) {
                              handleUpdateProductQuantity(productItem.inventoryItemId, numVal);
                            }
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        className={`w-20 px-2 py-1 border rounded text-sm text-gray-900 dark:bg-gray-700 dark:text-gray-100 ${isQuantityExceeded ? 'border-red-500 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(productItem.inventoryItemId)}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Remove product"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
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

          {/* Clear Form Button */}
          {(form.products.length > 0 || form.origin || form.destination) && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleClearForm}
                className="w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:text-white hover:bg-red-600 dark:hover:bg-red-700 border border-red-600 dark:border-red-400 rounded-md transition-colors font-medium"
              >
                Clear Form
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Pricing Breakdown */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wide">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Pricing Breakdown
          </h3>

          {calculating && (
            <div className="flex items-center justify-center py-12 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400 text-sm">Calculating pricing...</span>
            </div>
          )}

          {!calculating && priceBreakdown && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 border border-blue-200 dark:border-gray-600 rounded-lg p-6 space-y-3">
              {/* Per-Product Breakdown */}
              <div className="space-y-2 pb-3 border-b border-blue-200 dark:border-gray-600">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Products:</h4>
                {priceBreakdown.products.map((product, idx) => (
                  <div key={idx} className="space-y-1 pl-2 border-l-2 border-blue-300 dark:border-blue-600">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {product.inventoryItem.item_name}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {product.quantity} × ${product.inventoryItem.price_per_unit.toFixed(2)} = ${product.productCost.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {product.discountPercent > 0 && (
                      <div className="flex justify-between items-center text-xs text-green-700 dark:text-green-400">
                        <span>Discount ({product.discountPercent}%)</span>
                        <span className="font-medium">
                          -${(product.productCost - product.discountedProductCost).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-700 dark:text-gray-300">Subtotal:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        ${product.discountedProductCost.toFixed(2)}
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
              <DollarSign className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Fill in all fields to see pricing breakdown
              </p>
            </div>
          )}

          {/* Dispatch Button */}
          <button
            onClick={handleDispatch}
            disabled={!priceBreakdown || isSameLocation || loading || !form.vehicleId || !form.driverId || form.products.length === 0 || hasQuantityError}
            className="w-full bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-colors"
            title={hasQuantityError ? 'Cannot dispatch - one or more products exceed available stock' : ''}
          >
            <Send className="w-5 h-5" />
            Dispatch Shipment
          </button>

          {hasQuantityError && (
            <p className="text-xs text-red-600 dark:text-red-400 text-center font-semibold">
              ⚠️ Cannot dispatch - product quantities exceed available stock. Please adjust quantities or refresh inventory.
            </p>
          )}

          {!hasQuantityError && (!form.vehicleId || !form.driverId || form.products.length === 0) && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
              {form.products.length === 0 && 'Please add at least one product'}
              {form.products.length > 0 && !form.vehicleId && !form.driverId && `Please select a ${form.shippingMethod} and ${form.shippingMethod === 'plane' ? 'pilot' : 'driver'} to dispatch`}
              {form.products.length > 0 && !form.vehicleId && form.driverId && `Please select a ${form.shippingMethod} to dispatch`}
              {form.products.length > 0 && form.vehicleId && !form.driverId && `Please select a ${form.shippingMethod === 'plane' ? 'pilot' : 'driver'} to dispatch`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
