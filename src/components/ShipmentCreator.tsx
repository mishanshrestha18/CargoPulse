'use client';

import { useState, useEffect } from 'react';
import { Truck, MapPin, Package, DollarSign, AlertCircle, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Inventory, Location, Vehicle } from '@/types/database';

interface ShipmentForm {
  origin: string;
  destination: string;
  vehicleId: string;
  inventoryItemId: string;
  quantity: number;
  urgency: 'standard' | 'express';
}

interface PriceBreakdown {
  productCost: number;
  discountPercent: number;
  discountedProductCost: number;
  distanceKm: number;
  shippingCost: number;
  totalCost: number;
}

export default function ShipmentCreator() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<ShipmentForm>({
    origin: '',
    destination: '',
    vehicleId: '',
    inventoryItemId: '',
    quantity: 0,
    urgency: 'standard',
  });

  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);

  // Fetch all data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [locationsRes, vehiclesRes, inventoryRes] = await Promise.all([
        supabase.from('locations').select('*').order('name'),
        supabase.from('vehicles').select('*').eq('status', 'Idle').order('name'),
        supabase.from('inventory').select('*').gt('quantity', 0).order('item_name'),
      ]);

      if (locationsRes.error) throw locationsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (inventoryRes.error) throw inventoryRes.error;

      setLocations(locationsRes.data || []);
      setVehicles(vehiclesRes.data || []);
      setInventory(inventoryRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
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

  // Calculate distance using OSRM
  const calculateDistance = async (originLoc: Location, destLoc: Location): Promise<number> => {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLoc.longitude},${originLoc.latitude};${destLoc.longitude},${destLoc.latitude}?overview=false`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('Could not calculate route distance');
    }

    // Return distance in kilometers
    return data.routes[0].distance / 1000;
  };

  // Recalculate pricing whenever form changes
  useEffect(() => {
    const calculatePricing = async () => {
      if (!form.origin || !form.destination || !form.inventoryItemId || form.quantity <= 0) {
        setPriceBreakdown(null);
        return;
      }

      const selectedItem = inventory.find(item => String(item.id) === String(form.inventoryItemId));
      if (!selectedItem) return;

      const originLoc = locations.find(loc => String(loc.id) === String(form.origin));
      const destLoc = locations.find(loc => String(loc.id) === String(form.destination));

      if (!originLoc || !destLoc) return;

      try {
        setCalculating(true);
        setError(null);

        // Calculate distance
        const distanceKm = await calculateDistance(originLoc, destLoc);

        // Calculate product cost
        const productCost = selectedItem.price_per_unit * form.quantity;

        // Calculate discount
        const discountPercent = calculateDiscount(selectedItem, form.quantity);
        const discountMultiplier = 1 - (discountPercent / 100);
        const discountedProductCost = productCost * discountMultiplier;

        // Calculate shipping cost ($1.50/km base, 1.5x for express)
        const urgencyMultiplier = form.urgency === 'express' ? 1.5 : 1;
        const shippingCost = distanceKm * 1.50 * urgencyMultiplier;

        // Total cost
        const totalCost = discountedProductCost + shippingCost;

        setPriceBreakdown({
          productCost,
          discountPercent,
          discountedProductCost,
          distanceKm,
          shippingCost,
          totalCost,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to calculate pricing');
        setPriceBreakdown(null);
      } finally {
        setCalculating(false);
      }
    };

    calculatePricing();
  }, [form, inventory, locations]);

  const handleDispatch = async () => {
    if (!priceBreakdown) return;

    const selectedItem = inventory.find(item => String(item.id) === String(form.inventoryItemId));
    if (!selectedItem) return;

    // Validate origin and destination are different
    if (form.origin === form.destination) {
      setError('Origin and destination cannot be the same location');
      return;
    }

    // Validate quantity
    if (form.quantity > selectedItem.quantity) {
      setError(`Quantity exceeds available stock (${selectedItem.quantity} available)`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Update inventory quantity
      const newQuantity = selectedItem.quantity - form.quantity;
      const newStatus = newQuantity === 0 ? 'Out of Stock' : newQuantity < 10 ? 'Low Stock' : 'In Stock';

      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          quantity: newQuantity,
          status: newStatus,
        })
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      // Update vehicle status to In Transit
      if (form.vehicleId) {
        await supabase
          .from('vehicles')
          .update({ status: 'In Transit' })
          .eq('id', form.vehicleId);
      }

      setSuccess(`Shipment dispatched successfully! ${form.quantity} units of ${selectedItem.item_name} sent. Total cost: $${priceBreakdown.totalCost.toFixed(2)}`);

      // Reset form
      setForm({
        origin: '',
        destination: '',
        vehicleId: '',
        inventoryItemId: '',
        quantity: 0,
        urgency: 'standard',
      });
      setPriceBreakdown(null);

      // Refresh data
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dispatch shipment');
    } finally {
      setLoading(false);
    }
  };

  const selectedItem = form.inventoryItemId
    ? inventory.find(item => String(item.id) === String(form.inventoryItemId))
    : null;
  const isQuantityExceeded = selectedItem && form.quantity > selectedItem.quantity;
  const isSameLocation = form.origin && form.destination && form.origin === form.destination;

  if (loading && inventory.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading shipment creator...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Shipment</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Shipment Details */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Shipment Details</h3>

          {/* Origin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Origin Location
            </label>
            <select
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Destination Location
            </label>
            <select
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
                isSameLocation
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
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
              <p className="text-xs text-red-600 font-semibold mt-1">
                Origin and destination cannot be the same location
              </p>
            )}
          </div>

          {/* Vehicle Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Truck className="w-4 h-4 inline mr-1" />
              Select Vehicle (Fleet)
            </label>
            <select
              value={form.vehicleId}
              onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              <option value="">Select vehicle...</option>
              {vehicles.map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name} - {vehicle.type} (Capacity: {vehicle.capacity})
                </option>
              ))}
            </select>
            {vehicles.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No idle vehicles available</p>
            )}
          </div>

          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Package className="w-4 h-4 inline mr-1" />
              Select Product
            </label>
            <select
              value={form.inventoryItemId}
              onChange={(e) => setForm({ ...form, inventoryItemId: e.target.value, quantity: 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              <option value="">Select product...</option>
              {inventory.map(item => (
                <option key={item.id} value={item.id}>
                  {item.item_name} - Available: {item.quantity} units @ ${item.price_per_unit.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => {
                const inputValue = e.target.value;
                if (inputValue === '') {
                  setForm({ ...form, quantity: 0 });
                } else {
                  const numValue = parseInt(inputValue, 10);
                  if (!isNaN(numValue)) {
                    setForm({ ...form, quantity: numValue });
                  }
                }
              }}
              onFocus={(e) => {
                if (form.quantity === 0) {
                  e.target.select();
                }
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
                isQuantityExceeded
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="Enter quantity"
              disabled={!form.inventoryItemId || !selectedItem}
            />
            {selectedItem && (
              <div className="mt-1">
                <p className="text-xs text-gray-600">
                  Available: {selectedItem.quantity} units
                </p>
                {isQuantityExceeded && (
                  <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                    <span className="inline-block w-1 h-1 bg-red-600 rounded-full"></span>
                    Quantity exceeds available stock! Please enter {selectedItem.quantity} or less.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <span className="text-sm text-gray-900">Standard (1x)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="express"
                  checked={form.urgency === 'express'}
                  onChange={(e) => setForm({ ...form, urgency: e.target.value as 'standard' | 'express' })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-900">Express (1.5x)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column - Pricing Breakdown */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Pricing Breakdown
          </h3>

          {calculating && (
            <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 text-sm">Calculating pricing...</span>
            </div>
          )}

          {!calculating && priceBreakdown && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-blue-200">
                <span className="text-sm text-gray-700">Product Cost</span>
                <span className="text-sm font-medium text-gray-900">
                  ${priceBreakdown.productCost.toFixed(2)}
                </span>
              </div>

              {priceBreakdown.discountPercent > 0 && (
                <>
                  <div className="flex justify-between items-center text-green-700">
                    <span className="text-sm">Discount ({priceBreakdown.discountPercent}%)</span>
                    <span className="text-sm font-medium">
                      -${(priceBreakdown.productCost - priceBreakdown.discountedProductCost).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-blue-200">
                    <span className="text-sm text-gray-700">After Discount</span>
                    <span className="text-sm font-medium text-gray-900">
                      ${priceBreakdown.discountedProductCost.toFixed(2)}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Distance</span>
                <span className="text-sm font-medium text-gray-900">
                  {priceBreakdown.distanceKm.toFixed(1)} km
                </span>
              </div>

              <div className="flex justify-between items-center pb-3 border-b border-blue-200">
                <span className="text-sm text-gray-700">
                  Shipping Cost ({form.urgency === 'express' ? 'Express' : 'Standard'})
                </span>
                <span className="text-sm font-medium text-gray-900">
                  ${priceBreakdown.shippingCost.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-bold text-gray-900">Total Cost</span>
                <span className="text-2xl font-bold text-blue-600">
                  ${priceBreakdown.totalCost.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {!calculating && !priceBreakdown && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Fill in all fields to see pricing breakdown
              </p>
            </div>
          )}

          {/* Dispatch Button */}
          <button
            onClick={handleDispatch}
            disabled={!priceBreakdown || isQuantityExceeded || isSameLocation || loading || !form.vehicleId}
            className="w-full bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-colors"
          >
            <Send className="w-5 h-5" />
            Dispatch Shipment
          </button>

          {!form.vehicleId && form.inventoryItemId && (
            <p className="text-xs text-amber-600 text-center">
              Please select a vehicle to dispatch
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
