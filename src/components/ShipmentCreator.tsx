'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Truck, Plane, MapPin, Package, DollarSign, AlertCircle, Send, Plus, X, List, CheckCircle, Loader2, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Inventory, Location, Vehicle, Driver, ShipmentInsert, ShipmentItemInsert } from '@/types/database';
import { useNotifications } from '@/contexts/NotificationContext';
import { showToast } from '@/components/ToastContainer';
import { getDistance } from 'geolib';
import WeatherCard from '@/components/WeatherCard';
import type { WeatherAlert } from '@/lib/weather';
import { calculateRouteWithStops, calculateAirDistanceWithStops, canConnectByRoad, getRegion } from '@/lib/routing';

interface ManifestItem {
  inventoryItem: Inventory;
  quantity: number;
  productCost: number;
  discountPercent: number;
  discountedProductCost: number;
  deliveryLocationId: string; // Location ID where this item will be delivered (stop or final destination)
}

interface ShipmentForm {
  origin: string;
  destination: string;
  stops: string[]; // Array of location IDs for intermediate stops
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

interface ShipmentCreatorProps {
  refreshTrigger?: number;
  onDispatchSuccess?: () => void;
}

export default function ShipmentCreator({ refreshTrigger, onDispatchSuccess }: ShipmentCreatorProps) {
  const { addNotification } = useNotifications();
  const [locations, setLocations] = useState<Location[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const [form, setForm] = useState<ShipmentForm>({
    origin: '',
    destination: '',
    stops: [],
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
  const [weatherAlert, setWeatherAlert] = useState<WeatherAlert | null>(null);

  // Route type detection for cross-region shipments
  const [routeInfo, setRouteInfo] = useState<{
    requiresHybrid: boolean;
    originRegion: string;
    destRegion: string;
  } | null>(null);

  // Error/Warning/Success popup state
  const [errorPopup, setErrorPopup] = useState<{ title: string; message: string; type: 'error' | 'warning' | 'success' } | null>(null);

  // Memoize weather alert callback to prevent flickering
  const handleWeatherAlert = useCallback((alert: WeatherAlert) => {
    setWeatherAlert(alert);
  }, []);

  // Memoize destination city name to prevent unnecessary re-renders
  // Use the 'city' field for weather API if available, otherwise extract city from name
  const destinationCityName = useMemo(() => {
    const loc = locations.find(loc => String(loc.id) === String(form.destination));
    if (!loc) return '';

    // Prefer the city field if it exists and is valid
    if (loc.city && loc.city.trim() !== '') {
      return loc.city;
    }

    // Fallback: try to extract a recognizable city name from the location name
    // Remove common suffixes like "Hub", "Warehouse", "Distribution", "Airport", etc.
    const name = loc.name;
    const cleanedName = name
      .replace(/\s*(Hub|Warehouse|Distribution|Center|Airport|Port|Terminal|Depot|Facility)\s*/gi, '')
      .trim();

    return cleanedName || name;
  }, [locations, form.destination]);

  // Load form from localStorage on mount
  useEffect(() => {
    const savedForm = localStorage.getItem('shipmentCreatorForm');
    if (savedForm) {
      try {
        const parsed = JSON.parse(savedForm);
        const loadedForm = parsed.form || parsed;
        // Ensure stops array exists for backward compatibility
        setForm({
          ...loadedForm,
          stops: loadedForm.stops || [],
        });
        setManifest(parsed.manifest || []);
      } catch (err) {
        console.error('Failed to parse saved form:', err);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save form to localStorage whenever it changes
  useEffect(() => {
    if (form.origin || form.destination || manifest.length > 0) {
      localStorage.setItem('shipmentCreatorForm', JSON.stringify({ form, manifest }));
    }
  }, [form, manifest]);

  // Reset manifest when origin location changes
  useEffect(() => {
    // Clear manifest when origin changes (inventory availability changes)
    setManifest([]);
    setNewItem({ inventoryItemId: '', quantity: 1 });
  }, [form.origin]);

  // Clear destination if it conflicts with stops (e.g., from stale localStorage)
  useEffect(() => {
    if (form.destination && form.stops.some(stopId => String(stopId) === String(form.destination))) {
      setForm(prev => ({ ...prev, destination: '' }));
    }
  }, [form.stops, form.destination]);

  // Detect cross-region routes that require hybrid routing
  useEffect(() => {
    if (!form.origin || !form.destination) {
      setRouteInfo(null);
      return;
    }

    const originLoc = locations.find(loc => String(loc.id) === String(form.origin));
    const destLoc = locations.find(loc => String(loc.id) === String(form.destination));

    if (originLoc && destLoc) {
      const originRegion = getRegion(originLoc);
      const destRegion = getRegion(destLoc);
      const requiresHybrid = !canConnectByRoad(originLoc, destLoc);

      // Format region names for display
      const formatRegion = (region: string) => region.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      setRouteInfo({
        requiresHybrid,
        originRegion: formatRegion(originRegion),
        destRegion: formatRegion(destRegion),
      });
    }
  }, [form.origin, form.destination, locations]);

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

      // Also check if it requires hybrid routing (cross-ocean)
      const requiresHybrid = !canConnectByRoad(originLoc, destLoc);
      const shouldUsePlane = isAirOrigin || isAirDest || requiresHybrid;

      setForm(prev => ({
        ...prev,
        shippingMethod: shouldUsePlane ? 'plane' : 'truck',
        vehicleId: '',
      }));
    }
  }, [form.origin, form.destination, locations]);

  const fetchData = useCallback(async () => {
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
      // Don't throw - just log and continue
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to inventory changes in real-time with debouncing
  useEffect(() => {
    console.log('🔌 Setting up inventory real-time subscription');
    let debounceTimer: NodeJS.Timeout | null = null;

    const channel = supabase
      .channel('shipment-creator-inventory-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
        },
        (payload) => {
          console.log('📦 Inventory changed via Realtime:', payload);

          // Debounce: only fetch after 500ms of no changes
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchData().then(() => {
              setLastSyncTime(new Date());
            }).catch((err) => {
              console.error('Error fetching data after inventory change:', err);
            });
          }, 500);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to inventory changes');
        }
      });

    return () => {
      console.log('🔌 Cleaning up inventory subscription');
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Refetch data when refreshTrigger changes (from parent)
  // Don't include fetchData in deps to avoid infinite loops
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      console.log('🔄 Refresh trigger detected, refetching data...');
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

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

  // Helper to calculate air distance between two locations
  const calculateAirDistance = (loc1: Location, loc2: Location): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const dLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((loc1.latitude * Math.PI) / 180) *
        Math.cos((loc2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Optimize route using OSRM Trip API (with hybrid route support)
  const optimizeRoute = async () => {
    if (form.stops.length < 2) {
      setErrorPopup({
        title: 'Not Enough Stops',
        message: 'Route optimization requires at least 2 intermediate stops. Add more stops to optimize.',
        type: 'warning'
      });
      return;
    }

    const originLoc = locations.find(loc => String(loc.id) === String(form.origin));
    const destLoc = locations.find(loc => String(loc.id) === String(form.destination));

    if (!originLoc || !destLoc) {
      setErrorPopup({
        title: 'Missing Locations',
        message: 'Please select both origin and destination before optimizing.',
        type: 'warning'
      });
      return;
    }

    // Get stop locations
    const stopLocs = form.stops
      .map(stopId => locations.find(loc => String(loc.id) === String(stopId)))
      .filter((loc): loc is Location => loc !== undefined);

    if (stopLocs.length !== form.stops.length) {
      setErrorPopup({
        title: 'Invalid Stops',
        message: 'Some stop locations could not be found.',
        type: 'error'
      });
      return;
    }

    setOptimizing(true);

    try {
      const allLocations = [originLoc, ...stopLocs, destLoc];

      // Check if route requires hybrid (cross-ocean) routing
      const requiresHybrid = !canConnectByRoad(originLoc, destLoc) ||
        stopLocs.some((stop, idx) => {
          const prevLoc = idx === 0 ? originLoc : stopLocs[idx - 1];
          return !canConnectByRoad(prevLoc, stop);
        }) ||
        (stopLocs.length > 0 && !canConnectByRoad(stopLocs[stopLocs.length - 1], destLoc));

      let optimizedStops: string[];

      if (requiresHybrid) {
        // For hybrid routes, group locations by region and optimize within each region
        // Then use nearest-neighbor algorithm for cross-region ordering

        // Group stops by region
        const regionGroups = new Map<string, { stopId: string; location: Location; originalIndex: number }[]>();

        stopLocs.forEach((loc, idx) => {
          const region = getRegion(loc);
          if (!regionGroups.has(region)) {
            regionGroups.set(region, []);
          }
          regionGroups.get(region)!.push({
            stopId: form.stops[idx],
            location: loc,
            originalIndex: idx
          });
        });

        // Get origin and destination regions
        const originRegion = getRegion(originLoc);
        const destRegion = getRegion(destLoc);

        // Determine the order of regions to visit (origin region first, dest region last)
        const regionOrder: string[] = [originRegion];
        const visitedRegions = new Set([originRegion]);

        // Add intermediate regions in order of distance from origin
        const intermediateRegions = Array.from(regionGroups.keys()).filter(r => r !== originRegion && r !== destRegion);

        // Sort intermediate regions by nearest to origin/previous region
        let currentRegionCenter = originLoc;
        for (const region of intermediateRegions) {
          if (!visitedRegions.has(region)) {
            regionOrder.push(region);
            visitedRegions.add(region);
            // Update center to first location in this region
            const regionLocs = regionGroups.get(region);
            if (regionLocs && regionLocs.length > 0) {
              currentRegionCenter = regionLocs[0].location;
            }
          }
        }

        if (destRegion !== originRegion && !visitedRegions.has(destRegion)) {
          regionOrder.push(destRegion);
        }

        // Build optimized stops by processing each region
        optimizedStops = [];

        for (const region of regionOrder) {
          const regionStops = regionGroups.get(region);
          if (!regionStops || regionStops.length === 0) continue;

          if (regionStops.length === 1) {
            // Single stop in region, just add it
            optimizedStops.push(regionStops[0].stopId);
          } else {
            // Multiple stops in same region - try OSRM optimization
            try {
              const regionLocs = regionStops.map(s => s.location);
              const coords = regionLocs.map(loc => `${loc.longitude},${loc.latitude}`).join(';');
              const url = `https://router.project-osrm.org/trip/v1/driving/${coords}?roundtrip=false`;

              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000);
              const response = await fetch(url, { signal: controller.signal });
              clearTimeout(timeoutId);

              const data = await response.json();

              if (data.code === 'Ok' && data.waypoints) {
                // Reorder based on OSRM optimization
                const waypointOrder = data.waypoints
                  .map((wp: any, idx: number) => ({ idx, waypointIndex: wp.waypoint_index }))
                  .sort((a: any, b: any) => a.waypointIndex - b.waypointIndex);

                for (const wp of waypointOrder) {
                  optimizedStops.push(regionStops[wp.idx].stopId);
                }
              } else {
                // Fallback: add in original order
                regionStops.forEach(s => optimizedStops.push(s.stopId));
              }
            } catch {
              // Fallback: add in original order
              regionStops.forEach(s => optimizedStops.push(s.stopId));
            }
          }
        }

        showToast('dispatch', 'Hybrid Route Optimized!', 'Stops optimized within each region for cross-ocean routing.');
      } else {
        // Standard OSRM optimization for same-region routes
        const coords = allLocations.map(loc => `${loc.longitude},${loc.latitude}`).join(';');
        const url = `https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&destination=last&roundtrip=false`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        const data = await response.json();

        if (data.code !== 'Ok' || !data.waypoints) {
          throw new Error(data.message || 'Route optimization failed');
        }

        // Create array of {inputIndex, waypointIndex} for stops only
        const stopWaypoints = data.waypoints
          .map((wp: any, inputIndex: number) => ({ inputIndex, waypointIndex: wp.waypoint_index }))
          .filter((_: any, idx: number) => idx > 0 && idx < data.waypoints.length - 1)
          .sort((a: any, b: any) => a.waypointIndex - b.waypointIndex);

        optimizedStops = stopWaypoints.map((sw: any) => form.stops[sw.inputIndex - 1]);

        showToast('dispatch', 'Route Optimized!', 'Stops have been reordered for minimum travel time.');
      }

      // Check if order actually changed
      const orderChanged = !optimizedStops.every((stopId: string, idx: number) => stopId === form.stops[idx]);

      if (!orderChanged) {
        showToast('info', 'Route Already Optimal', 'The current stop order is already the most efficient route.');
        setOptimizing(false);
        return;
      }

      // Update form with optimized stops
      setForm(prev => ({ ...prev, stops: optimizedStops }));

    } catch (err: any) {
      console.error('Route optimization failed:', err);

      if (err.name === 'AbortError') {
        setErrorPopup({
          title: 'Optimization Timeout',
          message: 'Route optimization took too long. Please try again.',
          type: 'error'
        });
      } else {
        setErrorPopup({
          title: 'Optimization Failed',
          message: err.message || 'Failed to optimize route. Please try again.',
          type: 'error'
        });
      }
    } finally {
      setOptimizing(false);
    }
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

      // Get stop locations
      const stopLocs = form.stops
        .map(stopId => locations.find(loc => String(loc.id) === String(stopId)))
        .filter((loc): loc is Location => loc !== undefined);

      // Build array of all locations in order: origin -> stops -> destination
      const allLocations = [originLoc, ...stopLocs, destLoc];

      try {
        setCalculating(true);

        let distanceKm: number;
        let durationSeconds: number;

        if (form.shippingMethod === 'truck') {
          // Use OSRM road routing for trucks with stops
          const routeData = await calculateRouteWithStops(allLocations);
          distanceKm = routeData.distanceKm;
          durationSeconds = routeData.durationSeconds;
        } else {
          // Use geodesic distance for airplanes with stops
          distanceKm = calculateAirDistanceWithStops(allLocations);

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
      setErrorPopup({
        title: 'Product Required',
        message: 'Please select a product from the list.',
        type: 'warning'
      });
      return;
    }
    if (newItem.quantity <= 0) {
      setErrorPopup({
        title: 'Invalid Quantity',
        message: 'Quantity must be greater than 0.',
        type: 'warning'
      });
      return;
    }

    const inventoryItem = inventory.find(item => String(item.id) === String(newItem.inventoryItemId));
    if (!inventoryItem) return;

    // Check total quantity across all instances of this item in manifest
    const totalManifestQuantity = manifest
      .filter(m => String(m.inventoryItem.id) === String(newItem.inventoryItemId))
      .reduce((sum, m) => sum + m.quantity, 0);

    if (newItem.quantity + totalManifestQuantity > inventoryItem.quantity) {
      setErrorPopup({
        title: 'Quantity Exceeded',
        message: `Total quantity would exceed available stock.\n\nAvailable: ${inventoryItem.quantity}\nAlready in manifest: ${totalManifestQuantity}\nYou're trying to add: ${newItem.quantity}`,
        type: 'error'
      });
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
      deliveryLocationId: form.destination, // Default to final destination
    };

    setManifest([...manifest, manifestItem]);

    // Reset form
    setNewItem({
      inventoryItemId: '',
      quantity: 1,
    });
  };

  const handleRemoveFromManifest = (index: number) => {
    setManifest(manifest.filter((_, i) => i !== index));
  };

  const handleUpdateDeliveryLocation = (index: number, newLocationId: string) => {
    const currentItem = manifest[index];

    // Check if the SAME ITEM already has this destination in the manifest
    const hasSameItemSameDestination = manifest.some((m, i) =>
      i !== index &&
      String(m.inventoryItem.id) === String(currentItem.inventoryItem.id) &&
      m.deliveryLocationId === newLocationId
    );

    if (hasSameItemSameDestination) {
      const locationName = locations.find(loc => String(loc.id) === String(newLocationId))?.name || 'this location';
      setErrorPopup({
        title: 'Duplicate Item & Destination',
        message: `You already have "${currentItem.inventoryItem.item_name}" going to ${locationName} in this shipment.\n\nIf you want to send more units to ${locationName}, please increase the quantity of the existing item instead of creating a duplicate.`,
        type: 'error'
      });
      return;
    }

    setManifest(manifest.map((m, i) =>
      i === index
        ? { ...m, deliveryLocationId: newLocationId }
        : m
    ));
  };

  const handleUpdateManifestQuantity = (index: number, newQuantity: number) => {
    const manifestItem = manifest[index];
    if (!manifestItem) return;

    const inventoryItemId = manifestItem.inventoryItem.id;
    const inventoryItem = inventory.find(item => String(item.id) === String(inventoryItemId));
    if (!inventoryItem) return;

    // Check total quantity across all instances (excluding current item being updated)
    const totalOtherQuantity = manifest
      .filter((m, i) => i !== index && String(m.inventoryItem.id) === String(inventoryItemId))
      .reduce((sum, m) => sum + m.quantity, 0);

    if (newQuantity + totalOtherQuantity > inventoryItem.quantity) {
      setErrorPopup({
        title: 'Quantity Exceeded',
        message: `Total quantity would exceed available stock.\n\nAvailable: ${inventoryItem.quantity}\nAlready in manifest (other items): ${totalOtherQuantity}\nYou're trying to set: ${newQuantity}`,
        type: 'error'
      });
      return;
    }

    const productCost = inventoryItem.price_per_unit * newQuantity;
    const discountPercent = calculateDiscount(inventoryItem, newQuantity);
    const discountMultiplier = 1 - (discountPercent / 100);
    const discountedProductCost = productCost * discountMultiplier;

    setManifest(manifest.map((m, i) =>
      i === index
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

    // Set dispatching state
    setDispatching(true);

    try {
      // Validations
      if (form.origin === form.destination) {
        setErrorPopup({
          title: 'Invalid Route',
          message: 'Origin and destination cannot be the same location. Please select different locations.',
          type: 'warning'
        });
        setDispatching(false);
        return;
      }

      if (manifest.length === 0) {
        setErrorPopup({
          title: 'Empty Manifest',
          message: 'Please add at least one item to the manifest before dispatching.',
          type: 'warning'
        });
        setDispatching(false);
        return;
      }

      if (!form.driverId) {
        setErrorPopup({
          title: 'Driver Required',
          message: `Please select a ${form.shippingMethod === 'plane' ? 'pilot' : 'driver'} for the shipment.`,
          type: 'warning'
        });
        setDispatching(false);
        return;
      }

      if (!form.vehicleId) {
        setErrorPopup({
          title: 'Vehicle Required',
          message: `Please select a ${form.shippingMethod} for the shipment.`,
          type: 'warning'
        });
        setDispatching(false);
        return;
      }

      // Validate all manifest items have delivery locations
      const missingDeliveryLocation = manifest.find(item => !item.deliveryLocationId);
      if (missingDeliveryLocation) {
        setErrorPopup({
          title: 'Delivery Location Missing',
          message: `Please select a delivery location for "${missingDeliveryLocation.inventoryItem.item_name}".`,
          type: 'warning'
        });
        setDispatching(false);
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
      setErrorPopup({
        title: 'Data Fetch Error',
        message: 'Failed to fetch latest inventory data. Please try again.',
        type: 'error'
      });
      setDispatching(false);
      return;
    }

    // Validate all quantities against latest inventory (check total across all instances)
    console.log('📦 Validating manifest quantities...');

    // Group by inventory item ID to check total quantities
    const quantityByItem = new Map<string, { item: Inventory; totalRequested: number; name: string }>();

    for (const manifestItem of manifest) {
      const inventoryItem = latestInventory.find(item => String(item.id) === String(manifestItem.inventoryItem.id));

      if (!inventoryItem) {
        setErrorPopup({
          title: 'Product Not Found',
          message: `Product not found in inventory: "${manifestItem.inventoryItem.item_name}"`,
          type: 'error'
        });
        setDispatching(false);
        return;
      }

      const itemId = String(inventoryItem.id);
      const existing = quantityByItem.get(itemId);

      if (existing) {
        existing.totalRequested += manifestItem.quantity;
      } else {
        quantityByItem.set(itemId, {
          item: inventoryItem,
          totalRequested: manifestItem.quantity,
          name: inventoryItem.item_name
        });
      }
    }

    // Check if any item's total requested quantity exceeds available stock
    for (const [itemId, { item, totalRequested, name }] of quantityByItem) {
      if (totalRequested > item.quantity) {
        console.error(`❌ TOTAL QUANTITY EXCEEDED: ${name}`);
        setErrorPopup({
          title: 'Quantity Exceeded',
          message: `Cannot dispatch! Total quantity of "${name}" exceeds available stock.\n\nTotal Requested: ${totalRequested}\nAvailable: ${item.quantity}\n\nYou've added this item multiple times to different destinations.`,
          type: 'error'
        });
        setDispatching(false);
        return;
      }
    }
    console.log('✅ All quantities validated');

    // Check for duplicate item+destination combinations in manifest
    const itemDestinationMap = new Map<string, string[]>();
    for (const manifestItem of manifest) {
      const key = `${manifestItem.inventoryItem.id}_${manifestItem.deliveryLocationId}`;
      const existing = itemDestinationMap.get(key);
      if (existing) {
        // Found duplicate!
        const locationName = locations.find(l => String(l.id) === String(manifestItem.deliveryLocationId))?.name || 'Unknown';
        setErrorPopup({
          title: 'Duplicate Item & Destination',
          message: `You have "${manifestItem.inventoryItem.item_name}" going to ${locationName} multiple times in your manifest.\n\nPlease combine them into a single entry by increasing the quantity instead of having duplicates.`,
          type: 'error'
        });
        setDispatching(false);
        return;
      }
      itemDestinationMap.set(key, [manifestItem.inventoryItem.item_name]);
    }
    console.log('✅ No duplicate item+destination combinations');

      setLoading(true);

      // Calculate arrival time (including weather delay if present)
      const currentTime = new Date();
      const weatherDelaySeconds = (weatherAlert && weatherAlert.hasAlert && weatherAlert.estimatedDelay > 0)
        ? weatherAlert.estimatedDelay * 3600 // Convert hours to seconds
        : 0;
      const totalDurationSeconds = priceBreakdown.durationSeconds + weatherDelaySeconds;
      const arrivalTime = new Date(currentTime.getTime() + totalDurationSeconds * 1000);

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

      // Step 2: Create shipment_stops records for intermediate stops
      if (form.stops.length > 0) {
        const shipmentStopsToInsert = form.stops.map((stopId, index) => ({
          shipment_id: shipmentData.id,
          location_id: stopId,
          stop_order: index + 1, // 1-indexed
          arrival_time: null,
          departure_time: null,
          notes: null,
        }));

        const { error: stopsError } = await supabase
          .from('shipment_stops')
          .insert(shipmentStopsToInsert);

        if (stopsError) {
          console.error('⚠️ Failed to create shipment stops:', stopsError);
          // Don't throw - stops are optional, continue with shipment creation
        } else {
          console.log(`✅ ${shipmentStopsToInsert.length} shipment stops created`);
        }
      }

      // Step 3: Create shipment_items records with delivery_location_id
      const shipmentItemsToInsert: ShipmentItemInsert[] = manifest.map(manifestItem => ({
        shipment_id: shipmentData.id,
        inventory_item_id: Number(manifestItem.inventoryItem.id),
        item_name: manifestItem.inventoryItem.item_name,
        quantity: manifestItem.quantity,
        price_per_unit: manifestItem.inventoryItem.price_per_unit,
        total_cost: manifestItem.discountedProductCost,
        delivery_location_id: Number(manifestItem.deliveryLocationId), // NEW: Save individual delivery location
      }));

      const { error: itemsError } = await supabase
        .from('shipment_items')
        .insert(shipmentItemsToInsert);

      if (itemsError) throw itemsError;
      console.log(`✅ ${shipmentItemsToInsert.length} shipment items created`);

      // Step 4: Update inventory - Decrement at origin, increment at delivery locations
      const originLocation = locations.find(l => String(l.id) === String(form.origin));

      // Group manifest items by delivery location
      const itemsByDeliveryLocation = manifest.reduce((acc, item) => {
        const locId = item.deliveryLocationId;
        if (!acc[locId]) acc[locId] = [];
        acc[locId].push(item);
        return acc;
      }, {} as Record<string, ManifestItem[]>);

      // 1. Decrement inventory at origin
      for (const manifestItem of manifest) {
        const inventoryItem = latestInventory.find(item => String(item.id) === String(manifestItem.inventoryItem.id));
        if (!inventoryItem) continue;

        const newQuantity = inventoryItem.quantity - manifestItem.quantity;
        const newStatus = newQuantity === 0 ? 'Out of Stock' : newQuantity < 10 ? 'Low Stock' : 'In Stock';

        console.log(`📦 Decrementing at ${originLocation?.name}: ${inventoryItem.item_name} ${inventoryItem.quantity} -> ${newQuantity}`);

        const { error: inventoryError } = await supabase
          .from('inventory')
          .update({
            quantity: newQuantity,
            status: newStatus,
          })
          .eq('id', inventoryItem.id);

        if (inventoryError) throw inventoryError;
      }

      // 2. Increment/upsert inventory at each delivery location
      for (const [locationId, items] of Object.entries(itemsByDeliveryLocation)) {
        const deliveryLocation = locations.find(l => String(l.id) === String(locationId));
        if (!deliveryLocation) continue;

        console.log(`📦 Transferring ${items.length} items to ${deliveryLocation.name}`);

        for (const manifestItem of items) {
          // Check if item already exists at destination
          const { data: existingItem } = await supabase
            .from('inventory')
            .select('*')
            .eq('item_name', manifestItem.inventoryItem.item_name)
            .eq('location', deliveryLocation.name)
            .single();

          if (existingItem) {
            // Update existing inventory
            const newQuantity = existingItem.quantity + manifestItem.quantity;
            const newStatus = newQuantity === 0 ? 'Out of Stock' : newQuantity < 10 ? 'Low Stock' : 'In Stock';

            console.log(`📦 Updating at ${deliveryLocation.name}: ${existingItem.item_name} ${existingItem.quantity} -> ${newQuantity}`);

            const { error } = await supabase
              .from('inventory')
              .update({
                quantity: newQuantity,
                status: newStatus,
              })
              .eq('id', existingItem.id);

            if (error) throw error;
          } else {
            // Insert new inventory record
            console.log(`📦 Creating new inventory at ${deliveryLocation.name}: ${manifestItem.inventoryItem.item_name} x${manifestItem.quantity}`);

            const { error } = await supabase
              .from('inventory')
              .insert({
                sku: manifestItem.inventoryItem.sku || `SKU-${Date.now()}`,
                item_name: manifestItem.inventoryItem.item_name,
                quantity: manifestItem.quantity,
                location: deliveryLocation.name,
                price_per_unit: manifestItem.inventoryItem.price_per_unit,
                status: manifestItem.quantity < 10 ? 'Low Stock' : 'In Stock',
                discount_tier_1_qty: manifestItem.inventoryItem.discount_tier_1_qty || 0,
                discount_tier_1_percent: manifestItem.inventoryItem.discount_tier_1_percent || 0,
                discount_tier_2_qty: manifestItem.inventoryItem.discount_tier_2_qty || 0,
                discount_tier_2_percent: manifestItem.inventoryItem.discount_tier_2_percent || 0,
                discount_tier_3_qty: manifestItem.inventoryItem.discount_tier_3_qty || 0,
                discount_tier_3_percent: manifestItem.inventoryItem.discount_tier_3_percent || 0,
                max_discount: manifestItem.inventoryItem.max_discount || 20,
              });

            if (error) throw error;
          }
        }
      }

      // Step 5: Update vehicle and driver status
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

      // Show success popup
      setErrorPopup({
        title: 'Shipment Dispatched Successfully!',
        message: `${itemsSummary} dispatched from ${originLoc?.name || 'origin'} to ${destLoc?.name || 'destination'}.\n\nDriver: ${driverName}\nEstimated arrival: ${priceBreakdown ? (priceBreakdown.durationSeconds / 3600).toFixed(1) : '?'} hours`,
        type: 'success'
      });

      // Reset form
      setForm({
        origin: '',
        destination: '',
        stops: [],
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

      // Notify parent component to refresh all (this will trigger fetchData via refreshTrigger)
      if (onDispatchSuccess) {
        onDispatchSuccess();
      }
    } catch (err) {
      console.error('Failed to dispatch shipment:', err);
      const errorMessage = err instanceof Error ? err.message : (typeof err === 'object' && err !== null ? JSON.stringify(err) : 'Failed to dispatch shipment');
      console.error('Error details:', errorMessage);
      setErrorPopup({
        title: 'Dispatch Failed',
        message: `Failed to dispatch shipment: ${errorMessage}`,
        type: 'error'
      });
    } finally {
      setDispatching(false);
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
        stops: [],
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Create Shipment</h2>
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
            <span className="w-1.5 h-1.5 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"></span>
            Live
          </span>
        </div>
        {manifest.length > 0 && (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {manifest.length} items • {manifest.reduce((sum, m) => sum + m.quantity, 0)} units
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left Column - Route & Manifest Builder */}
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-xs uppercase tracking-wide">Route Details</h3>

          {/* Origin */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
              <MapPin className="w-3 h-3 inline mr-1" />
              Origin
            </label>
            <select
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
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
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
              <MapPin className="w-3 h-3 inline mr-1" />
              Destination
            </label>
            <select
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              className={`w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 text-gray-900 dark:bg-gray-700 dark:text-gray-100 ${
                isSameLocation
                  ? 'border-red-500 focus:ring-red-500 dark:focus:ring-red-400'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400'
              }`}
            >
              <option value="">Select destination...</option>
              {locations
                .filter(loc => {
                  const locIdStr = String(loc.id);
                  // Filter out origin and already selected stops
                  return (
                    locIdStr !== String(form.origin) &&
                    !form.stops.some(stopId => String(stopId) === locIdStr)
                  );
                })
                .map(loc => (
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

          {/* Route Info Banner - Shows when cross-region */}
          {routeInfo && (
            <div className={`p-3 rounded-lg border ${
              routeInfo.requiresHybrid
                ? 'bg-gradient-to-r from-amber-50 to-blue-50 dark:from-amber-900/20 dark:to-blue-900/20 border-amber-300 dark:border-amber-600'
                : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600'
            }`}>
              <div className="flex items-start gap-2">
                {routeInfo.requiresHybrid ? (
                  <>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Truck className="w-4 h-4 text-amber-600" />
                      <span className="text-gray-400">+</span>
                      <Plane className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        Hybrid Route Required
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {routeInfo.originRegion} to {routeInfo.destRegion} requires air freight for ocean crossing.
                        Ground transport will be used for land segments.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                        Ground Route Available
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        Direct road transport from {routeInfo.originRegion} to {routeInfo.destRegion}.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Intermediate Stops */}
          <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Stops ({form.stops.length})
            </label>

            {/* List of current stops */}
            {form.stops.length > 0 && (
              <div className="space-y-2 mb-3">
                {form.stops.map((stopId, index) => {
                  const stopLocation = locations.find(loc => String(loc.id) === String(stopId));
                  return (
                    <div
                      key={index}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(index));
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
                        if (draggedIndex === index) return;

                        const newStops = [...form.stops];
                        const [draggedItem] = newStops.splice(draggedIndex, 1);
                        newStops.splice(index, 0, draggedItem);
                        setForm({ ...form, stops: newStops });
                      }}
                      className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-600 cursor-move hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {stopLocation?.name || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({stopLocation?.type})
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const newStops = form.stops.filter((_, i) => i !== index);
                          setForm({ ...form, stops: newStops });
                        }}
                        className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded transition-colors"
                        title="Remove stop"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new stop */}
            <div className="flex gap-2">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    setForm({ ...form, stops: [...form.stops, e.target.value] });
                    e.target.value = ''; // Reset select
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                disabled={!form.origin}
              >
                <option value="">Select stop location...</option>
                {locations
                  .filter(loc => {
                    // Filter out origin, destination, and already selected stops
                    const locIdStr = String(loc.id);
                    const originIdStr = String(form.origin);
                    const destIdStr = form.destination ? String(form.destination) : null;

                    return (
                      locIdStr !== originIdStr &&
                      (!destIdStr || locIdStr !== destIdStr) &&
                      !form.stops.some(stopId => String(stopId) === locIdStr)
                    );
                  })
                  .map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type})
                    </option>
                  ))}
              </select>
              <button
                onClick={() => {
                  // This is handled by the select onChange, but keeping button for UI consistency
                }}
                disabled={!form.origin}
                className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                title="Select a location from the dropdown to add a stop"
              >
                <Plus className="w-4 h-4" />
                Add Stop
              </button>
            </div>

            {/* Optimize Route Button - only show when 2+ stops */}
            {form.stops.length >= 2 && form.origin && form.destination && (
              <button
                onClick={optimizeRoute}
                disabled={optimizing}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-sm"
                title="Reorder stops to minimize travel time"
              >
                {optimizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Optimizing Route...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Optimize Route
                  </>
                )}
              </button>
            )}

            {form.stops.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Add waypoints between origin and destination for multi-stop routes
              </p>
            )}
            {form.stops.length === 1 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Add one more stop to enable route optimization
              </p>
            )}
          </div>

          {/* Weather Card - Real-Time Weather Integration */}
          {form.destination && destinationCityName && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Destination Weather
              </label>
              <WeatherCard
                cityName={destinationCityName}
                onWeatherAlert={handleWeatherAlert}
              />
            </div>
          )}

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
          <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <List className="w-4 h-4 inline mr-1" />
              Cargo Manifest
            </label>

            <div className="space-y-2">
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
                    return itemBelongsToOrigin && hasQuantity;
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
                      (inventory.find(item => String(item.id) === String(newItem.inventoryItemId))?.quantity ?? 0) < newItem.quantity
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
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {manifest.length} items, {manifest.reduce((sum, m) => sum + m.quantity, 0)} units
                  </h4>
                </div>

                {/* Check for quantity issues and show warning banner */}
                {(() => {
                  const quantityIssues = new Map<string, { name: string; total: number; available: number }>();

                  manifest.forEach(m => {
                    const invItem = inventory.find(item => String(item.id) === String(m.inventoryItem.id));
                    if (!invItem) return;

                    const itemId = String(m.inventoryItem.id);
                    const existing = quantityIssues.get(itemId);

                    if (existing) {
                      existing.total += m.quantity;
                    } else {
                      const totalQty = manifest
                        .filter(mi => String(mi.inventoryItem.id) === itemId)
                        .reduce((sum, mi) => sum + mi.quantity, 0);

                      if (totalQty > invItem.quantity) {
                        quantityIssues.set(itemId, {
                          name: invItem.item_name,
                          total: totalQty,
                          available: invItem.quantity
                        });
                      }
                    }
                  });

                  if (quantityIssues.size > 0) {
                    return (
                      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 dark:border-red-600 rounded-md p-2 mb-2">
                        <p className="text-xs font-bold text-red-800 dark:text-red-200 mb-1">⚠️ Quantity Exceeded!</p>
                        {Array.from(quantityIssues.values()).map((issue, idx) => (
                          <p key={idx} className="text-xs text-red-700 dark:text-red-300">
                            <strong>{issue.name}:</strong> Total requested {issue.total}, but only {issue.available} available
                          </p>
                        ))}
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Reduce quantities or remove duplicate items before dispatching.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}

                {manifest.map((manifestItem, manifestIndex) => {
                  const invItem = inventory.find(item => String(item.id) === String(manifestItem.inventoryItem.id));

                  // Check total quantity for this item across all manifest entries
                  const totalManifestQuantity = manifest
                    .filter(m => String(m.inventoryItem.id) === String(manifestItem.inventoryItem.id))
                    .reduce((sum, m) => sum + m.quantity, 0);
                  const isQuantityExceeded = invItem && totalManifestQuantity > invItem.quantity;

                  // Get all possible delivery locations (stops + destination)
                  const deliveryLocations = [
                    ...form.stops.map(stopId => locations.find(loc => String(loc.id) === String(stopId))).filter(Boolean),
                    locations.find(loc => String(loc.id) === String(form.destination))
                  ].filter(Boolean) as Location[];

                  const deliveryLocation = locations.find(loc => String(loc.id) === String(manifestItem.deliveryLocationId));

                  return (
                    <div key={manifestIndex} className={`p-2 rounded border-2 transition-colors ${isQuantityExceeded ? 'bg-red-50 dark:bg-red-900/10 border-red-500 dark:border-red-600' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'}`}>
                      <div className="flex items-start gap-2 mb-1.5">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{manifestItem.inventoryItem.item_name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            ${manifestItem.inventoryItem.price_per_unit.toFixed(2)}/unit • Available: {invItem?.quantity || 0}
                            {manifestItem.discountPercent > 0 && (
                              <span className="text-green-600 dark:text-green-400 ml-2">
                                {manifestItem.discountPercent}% discount applied
                              </span>
                            )}
                          </p>
                          {isQuantityExceeded && (
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
                              ⚠️ Total quantity exceeds available stock ({invItem?.quantity || 0} available, {totalManifestQuantity} in manifest)
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
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
                                  handleUpdateManifestQuantity(manifestIndex, numVal);
                                }
                              }
                            }}
                            onFocus={(e) => e.target.select()}
                            className={`w-20 px-2 py-1 border rounded text-sm text-gray-900 dark:bg-gray-700 dark:text-gray-100 ${isQuantityExceeded ? 'border-red-500 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'}`}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveFromManifest(manifestIndex)}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Remove from manifest"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Delivery Location Selector */}
                      {deliveryLocations.length > 0 && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <label className="text-xs text-gray-600 dark:text-gray-400">Deliver to:</label>
                          <select
                            value={manifestItem.deliveryLocationId}
                            onChange={(e) => handleUpdateDeliveryLocation(manifestIndex, e.target.value)}
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            {deliveryLocations.map((loc, idx) => {
                              const isStop = form.stops.includes(String(loc.id));
                              const stopNumber = isStop ? form.stops.indexOf(String(loc.id)) + 1 : null;
                              return (
                                <option key={`${manifestIndex}-${loc.id}-${idx}`} value={loc.id}>
                                  {stopNumber ? `Stop ${stopNumber}: ` : 'Destination: '}{loc.name}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
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
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wide">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Cost Breakdown
          </h3>

          {calculating && (
            <div className="flex items-center justify-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400 text-sm">Calculating...</span>
            </div>
          )}

          {!calculating && priceBreakdown && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 border border-blue-200 dark:border-gray-600 rounded-lg p-4 space-y-2">
              {/* Manifest Breakdown */}
              <div className="space-y-1 pb-2 border-b border-blue-200 dark:border-gray-600">
                <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">Cargo Manifest:</h4>
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

              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
                  <span>Estimated Delivery Time</span>
                  <span>
                    {(priceBreakdown.durationSeconds / 3600).toFixed(1)} hours
                    {weatherAlert && weatherAlert.hasAlert && weatherAlert.estimatedDelay > 0 && (
                      <span className="text-orange-600 dark:text-orange-400 font-semibold">
                        {' '}+ {weatherAlert.estimatedDelay}h (Weather Delay)
                      </span>
                    )}
                  </span>
                </div>
                {weatherAlert && weatherAlert.hasAlert && weatherAlert.estimatedDelay > 0 && (
                  <div className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                    Total ETA: {((priceBreakdown.durationSeconds / 3600) + weatherAlert.estimatedDelay).toFixed(1)} hours
                  </div>
                )}
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
            disabled={dispatching || !priceBreakdown || isSameLocation || loading || !form.vehicleId || !form.driverId || manifest.length === 0 || hasQuantityError}
            className="w-full bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-colors"
            title={hasQuantityError ? 'Cannot dispatch - quantities exceed available stock' : ''}
          >
            {dispatching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Dispatching...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Dispatch Shipment
              </>
            )}
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

      {/* Error/Warning/Success Modal Popup */}
      {errorPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md border-2 ${
            errorPopup.type === 'error'
              ? 'border-red-500 dark:border-red-600'
              : errorPopup.type === 'warning'
              ? 'border-yellow-500 dark:border-yellow-600'
              : 'border-green-500 dark:border-green-600'
          }`}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-2 rounded-full ${
                errorPopup.type === 'error'
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : errorPopup.type === 'warning'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30'
                  : 'bg-green-100 dark:bg-green-900/30'
              }`}>
                {errorPopup.type === 'success' ? (
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className={`w-6 h-6 ${
                    errorPopup.type === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-yellow-600 dark:text-yellow-400'
                  }`} />
                )}
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold mb-1 ${
                  errorPopup.type === 'error'
                    ? 'text-red-800 dark:text-red-200'
                    : errorPopup.type === 'warning'
                    ? 'text-yellow-800 dark:text-yellow-200'
                    : 'text-green-800 dark:text-green-200'
                }`}>
                  {errorPopup.title}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                  {errorPopup.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setErrorPopup(null)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  errorPopup.type === 'error'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : errorPopup.type === 'warning'
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
