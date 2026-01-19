'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { supabase } from '@/lib/supabase';
import type { Location } from '@/types/database';
import L from 'leaflet';
import { Truck, Plane, Clock, Package } from 'lucide-react';
import * as turf from '@turf/turf';
import { canConnectByRoad } from '@/lib/routing';

interface ActiveShipment {
  id: string;
  driver_id: string;
  vehicle_id: string;
  origin: string;
  destination: string;
  shipping_method: string;
  created_at: string;
  arrival_time: string;
  status: string;
  urgency: 'standard' | 'express';
  drivers: { name: string };
  vehicles: { name: string };
  inventory: { item_name: string };
  quantity: number;
}

interface RouteSegment {
  type: 'road' | 'air';
  geometry: [number, number][];
}

interface ShipmentWithRoute extends ActiveShipment {
  routeGeometry: [number, number][];
  routeSegments: RouteSegment[];
  originCoords: [number, number];
  destCoords: [number, number];
  currentPosition: [number, number];
  progress: number;
  bearing: number; // Direction the vehicle is facing (degrees)
  isHybridRoute: boolean;
  stops: Array<{
    id: number;
    location_id: number;
    stop_order: number;
    name: string;
    coords: [number, number];
    notes?: string;
  }>;
}

// Fix default marker icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create custom truck icon with rotation support
const createTruckIcon = (color: string, rotation: number = 0) => {
  return L.divIcon({
    className: 'custom-truck-marker',
    html: `
      <div style="
        position: relative;
        width: 44px;
        height: 44px;
      ">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(${rotation}deg);
          background: ${color};
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse 2s ease-in-out infinite;
        ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style="transform: rotate(-90deg);">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
          </svg>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% { box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
            50% { box-shadow: 0 6px 20px rgba(0,0,0,0.6), 0 0 20px ${color}80; }
          }
        </style>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

// Create custom airplane icon with rotation support
const createAirplaneIcon = (color: string, rotation: number = 0) => {
  return L.divIcon({
    className: 'custom-airplane-marker',
    html: `
      <div style="
        position: relative;
        width: 44px;
        height: 44px;
      ">
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(${rotation}deg);
          background: ${color};
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse 2s ease-in-out infinite;
        ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style="transform: rotate(-90deg);">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% { box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
            50% { box-shadow: 0 6px 20px rgba(0,0,0,0.6), 0 0 20px ${color}80; }
          }
        </style>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

// Origin/Destination markers
const createLocationIcon = (color: string, label: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 28px;
        height: 28px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-weight: bold;
          font-size: 12px;
          margin-bottom: 3px;
        ">${label}</span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
};

const originIcon = createLocationIcon('#10b981', '●');
const destinationIcon = createLocationIcon('#ef4444', '●');

// Create numbered stop icons for intermediate waypoints
const createStopIcon = (stopNumber: number) => {
  return L.divIcon({
    className: 'custom-stop-marker',
    html: `
      <div style="
        background-color: #8b5cf6;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          color: white;
          font-weight: bold;
          font-size: 11px;
        ">${stopNumber}</span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Sub-component to handle map auto-zoom
function MapUpdater({ locations, shipments }: { locations: Location[]; shipments: ShipmentWithRoute[] }) {
  const map = useMap();

  useEffect(() => {
    if (shipments.length > 0) {
      const bounds = L.latLngBounds([
        ...shipments.map(s => s.currentPosition),
        ...shipments.flatMap(s => s.routeGeometry),
        ...shipments.flatMap(s => s.stops?.map(stop => stop.coords) || []),
      ]);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 12 });
    } else if (locations.length > 0) {
      const bounds = L.latLngBounds(
        locations.map(loc => [loc.latitude, loc.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, shipments.length, map]); // Only react to shipments.length changes for initial zoom

  return null;
}

// Animated vehicle marker component
function AnimatedVehicleMarker({ shipment }: { shipment: ShipmentWithRoute }) {
  const [position, setPosition] = useState<[number, number]>(shipment.currentPosition);
  const [currentBearing, setCurrentBearing] = useState(shipment.bearing);
  const [progress, setProgress] = useState(shipment.progress);
  const animationRef = useRef<number | null>(null);

  // Calculate position along route using turf
  const calculatePositionAlongRoute = useCallback((progressPercent: number): { pos: [number, number]; bearing: number } => {
    if (shipment.routeGeometry.length < 2) {
      return { pos: shipment.routeGeometry[0] || shipment.originCoords, bearing: 0 };
    }

    // Clamp progress
    const clampedProgress = Math.max(0, Math.min(100, progressPercent));

    // Convert route geometry to GeoJSON linestring (turf uses [lon, lat])
    const routeCoords = shipment.routeGeometry.map(coord => [coord[1], coord[0]]);
    const line = turf.lineString(routeCoords);
    const totalLength = turf.length(line, { units: 'kilometers' });
    const targetDistance = (clampedProgress / 100) * totalLength;

    // Get point along the route
    const pointAlong = turf.along(line, targetDistance, { units: 'kilometers' });
    const [lon, lat] = pointAlong.geometry.coordinates;

    // Calculate bearing to the next point for rotation
    let bearingAngle = 0;
    if (clampedProgress < 100) {
      // Get a point slightly ahead for bearing calculation
      const aheadDistance = Math.min(targetDistance + 0.5, totalLength);
      const pointAhead = turf.along(line, aheadDistance, { units: 'kilometers' });
      bearingAngle = turf.bearing(pointAlong, pointAhead);
    }

    return { pos: [lat, lon] as [number, number], bearing: bearingAngle };
  }, [shipment.routeGeometry, shipment.originCoords]);

  // Animation loop using requestAnimationFrame
  useEffect(() => {
    const startTime = new Date(shipment.created_at).getTime();
    const endTime = new Date(shipment.arrival_time).getTime();
    const totalDuration = endTime - startTime;

    const animate = () => {
      const now = Date.now();
      let newProgress: number;

      if (now <= startTime) {
        // Before departure: vehicle at origin
        newProgress = 0;
      } else if (now >= endTime) {
        // After arrival: vehicle at destination
        newProgress = 100;
      } else {
        // In transit: calculate exact progress
        newProgress = ((now - startTime) / totalDuration) * 100;
      }

      // Calculate new position and bearing
      const { pos, bearing: newBearing } = calculatePositionAlongRoute(newProgress);

      setPosition(pos);
      setCurrentBearing(newBearing);
      setProgress(newProgress);

      // Continue animation if not at destination
      if (newProgress < 100) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    // Start animation
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [shipment.created_at, shipment.arrival_time, calculatePositionAlongRoute]);

  // Get the appropriate icon based on vehicle type, urgency, and bearing
  const getVehicleIcon = () => {
    const isPlane = shipment.shipping_method === 'plane';
    const isExpress = shipment.urgency === 'express';
    const color = isExpress ? '#ea580c' : '#2563eb';

    if (isPlane) {
      return createAirplaneIcon(color, currentBearing);
    } else {
      return createTruckIcon(color, currentBearing);
    }
  };

  const formatTimeRemaining = (arrivalTime: string): string => {
    const remaining = new Date(arrivalTime).getTime() - Date.now();
    if (remaining <= 0) return 'Arriving...';

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  // Determine current status text
  const getStatusText = () => {
    if (progress <= 0) return 'Preparing for departure';
    if (progress >= 100) return 'Arrived at destination';
    return `In Transit (${progress.toFixed(1)}% Complete)`;
  };

  return (
    <Marker
      position={position}
      icon={getVehicleIcon()}
    >
      <Popup>
        <div className="text-sm min-w-[220px]">
          <div className="flex items-center gap-2 mb-2">
            {shipment.isHybridRoute ? (
              <div className="flex items-center gap-1">
                <Truck className="w-4 h-4 text-amber-600" />
                <span className="text-gray-400">+</span>
                <Plane className="w-4 h-4 text-blue-600" />
              </div>
            ) : shipment.shipping_method === 'plane' ? (
              <Plane className="w-4 h-4 text-blue-600" />
            ) : (
              <Truck className="w-4 h-4 text-blue-600" />
            )}
            <h3 className="font-bold text-gray-900">{shipment.vehicles?.name}</h3>
          </div>

          {/* Status indicator */}
          <div className={`mb-2 px-2 py-1 rounded text-xs font-medium ${
            progress >= 100
              ? 'bg-green-100 text-green-700'
              : progress <= 0
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {getStatusText()}
          </div>

          {/* Hybrid route indicator */}
          {shipment.isHybridRoute && (
            <div className="mb-2 px-2 py-1 bg-gradient-to-r from-amber-50 to-blue-50 rounded text-xs">
              <span className="text-amber-700">Hybrid Route</span>
              <span className="text-gray-500 mx-1">-</span>
              <span className="text-gray-600">Ground + Air freight</span>
            </div>
          )}

          <div className="space-y-1 text-xs text-gray-700">
            <p><span className="font-medium">{shipment.shipping_method === 'plane' ? 'Pilot' : 'Driver'}:</span> {shipment.drivers?.name}</p>
            <div className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              <span>{shipment.quantity}x {shipment.inventory?.item_name}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatTimeRemaining(shipment.arrival_time)}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  shipment.isHybridRoute
                    ? 'bg-gradient-to-r from-amber-500 via-blue-500 to-amber-500'
                    : shipment.urgency === 'express'
                      ? 'bg-gradient-to-r from-orange-500 to-red-500'
                      : 'bg-gradient-to-r from-blue-500 to-green-500'
                }`}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">{progress.toFixed(1)}%</span>
              <span className="text-xs text-gray-500">
                {progress >= 100 ? 'Complete' : 'En route'}
              </span>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-gray-200 flex gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              shipment.urgency === 'express'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {shipment.urgency.toUpperCase()}
            </span>
            {shipment.isHybridRoute && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                HYBRID
              </span>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default function MapWithLiveTracking() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [shipments, setShipments] = useState<ShipmentWithRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const dataFetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate current position along route based on time progress (for initial fetch)
  const calculateCurrentPosition = (
    routeGeometry: [number, number][],
    createdAt: string,
    arrivalTime: string
  ): { position: [number, number]; progress: number; bearing: number } => {
    const start = new Date(createdAt).getTime();
    const end = new Date(arrivalTime).getTime();
    const now = Date.now();

    // Calculate progress (0 to 1)
    let progress = 0;
    if (now >= end) {
      progress = 1;
    } else if (now > start) {
      progress = (now - start) / (end - start);
    }

    if (routeGeometry.length < 2) {
      return { position: routeGeometry[0] || [0, 0], progress: progress * 100, bearing: 0 };
    }

    // Convert route geometry to GeoJSON linestring (turf uses [lon, lat])
    const routeCoords = routeGeometry.map(coord => [coord[1], coord[0]]);
    const line = turf.lineString(routeCoords);
    const totalLength = turf.length(line, { units: 'kilometers' });
    const targetDistance = progress * totalLength;

    // Get point along the route
    const pointAlong = turf.along(line, targetDistance, { units: 'kilometers' });
    const [lon, lat] = pointAlong.geometry.coordinates;

    // Calculate bearing to the next point for rotation
    let bearingAngle = 0;
    if (progress < 1) {
      const aheadDistance = Math.min(targetDistance + 0.5, totalLength);
      const pointAhead = turf.along(line, aheadDistance, { units: 'kilometers' });
      bearingAngle = turf.bearing(pointAlong, pointAhead);
    }

    return { position: [lat, lon] as [number, number], progress: progress * 100, bearing: bearingAngle };
  };

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const fetchActiveShipments = async () => {
    try {
      const { data: shipmentsData, error: shipmentsError } = await supabase
        .from('shipments')
        .select('*')
        .eq('status', 'In Transit');

      if (shipmentsError) throw shipmentsError;

      if (!shipmentsData || shipmentsData.length === 0) {
        setShipments([]);
        return;
      }

      // Get all shipment IDs for fetching stops
      const shipmentIds = shipmentsData.map((s: any) => s.id);

      // Fetch related data separately
      const [driversRes, vehiclesRes, inventoryRes, locationsRes, stopsRes] = await Promise.all([
        supabase.from('drivers').select('id, name'),
        supabase.from('vehicles').select('id, name'),
        supabase.from('inventory').select('id, item_name'),
        supabase.from('locations').select('*'),
        supabase.from('shipment_stops')
          .select('*')
          .in('shipment_id', shipmentIds)
          .order('stop_order', { ascending: true }),
      ]);

      // Create lookup maps
      const driversMap = new Map(driversRes.data?.map(d => [String(d.id), d]) || []);
      const vehiclesMap = new Map(vehiclesRes.data?.map(v => [String(v.id), v]) || []);
      const inventoryMap = new Map(inventoryRes.data?.map(i => [String(i.id), i]) || []);
      const locationsMap = new Map<string, Location>();
      locationsRes.data?.forEach(loc => {
        locationsMap.set(String(loc.id), loc);
      });

      // Group stops by shipment_id
      const stopsMap = new Map<string, Array<{ id: number; location_id: number; stop_order: number; notes?: string }>>();
      stopsRes.data?.forEach((stop: any) => {
        const shipmentId = String(stop.shipment_id);
        if (!stopsMap.has(shipmentId)) {
          stopsMap.set(shipmentId, []);
        }
        stopsMap.get(shipmentId)!.push({
          id: stop.id,
          location_id: stop.location_id,
          stop_order: stop.stop_order,
          notes: stop.notes,
        });
      });

      // Fetch route geometry and calculate positions
      const shipmentsWithRoutes = await Promise.all(
        shipmentsData.map(async (shipment: any) => {
          const originLoc = locationsMap.get(String(shipment.origin));
          const destLoc = locationsMap.get(String(shipment.destination));

          if (!originLoc || !destLoc) {
            return null;
          }

          // Get intermediate stops for this shipment
          const shipmentStops = stopsMap.get(String(shipment.id)) || [];
          const stopsWithCoords = shipmentStops
            .map(stop => {
              const loc = locationsMap.get(String(stop.location_id));
              if (!loc) return null;
              return {
                id: stop.id,
                location_id: stop.location_id,
                stop_order: stop.stop_order,
                name: loc.name,
                coords: [loc.latitude, loc.longitude] as [number, number],
                notes: stop.notes,
              };
            })
            .filter((s): s is NonNullable<typeof s> => s !== null)
            .sort((a, b) => a.stop_order - b.stop_order);

          // Determine route geometry based on shipping method
          let routeGeometry: [number, number][];
          let routeSegments: RouteSegment[] = [];
          let isHybridRoute = false;

          // Build list of all waypoints with their locations
          const allWaypoints: Location[] = [
            originLoc,
            ...stopsWithCoords.map(s => {
              const loc = locationsMap.get(String(s.location_id));
              return loc!;
            }).filter(Boolean),
            destLoc,
          ];

          try {
            if (shipment.shipping_method === 'plane') {
              // Use geodesic (great circle) path for airplanes
              if (stopsWithCoords.length > 0) {
                const allPoints = [
                  { lat: originLoc.latitude, lon: originLoc.longitude },
                  ...stopsWithCoords.map(s => ({ lat: s.coords[0], lon: s.coords[1] })),
                  { lat: destLoc.latitude, lon: destLoc.longitude },
                ];
                routeGeometry = [];
                for (let i = 0; i < allPoints.length - 1; i++) {
                  const start = turf.point([allPoints[i].lon, allPoints[i].lat]);
                  const end = turf.point([allPoints[i + 1].lon, allPoints[i + 1].lat]);
                  const arc = turf.greatCircle(start, end, { npoints: 50 });
                  const segmentCoords = (arc.geometry.coordinates as number[][]).map(
                    (coord) => [coord[1], coord[0]] as [number, number]
                  );
                  if (i > 0) segmentCoords.shift();
                  routeGeometry.push(...segmentCoords);
                  routeSegments.push({ type: 'air', geometry: segmentCoords });
                }
              } else {
                const start = turf.point([originLoc.longitude, originLoc.latitude]);
                const end = turf.point([destLoc.longitude, destLoc.latitude]);
                const arc = turf.greatCircle(start, end, { npoints: 100 });
                routeGeometry = (arc.geometry.coordinates as number[][]).map(
                  (coord) => [coord[1], coord[0]] as [number, number]
                );
                routeSegments.push({ type: 'air', geometry: routeGeometry });
              }
            } else {
              // For ground vehicles, check if we need hybrid routing
              let needsHybridRouting = false;
              for (let i = 0; i < allWaypoints.length - 1; i++) {
                if (!canConnectByRoad(allWaypoints[i], allWaypoints[i + 1])) {
                  needsHybridRouting = true;
                  break;
                }
              }

              if (needsHybridRouting) {
                // HYBRID ROUTING: Use air for ocean crossings, road for ground segments
                isHybridRoute = true;
                routeGeometry = [];

                const fetchWithTimeout = async (url: string, timeoutMs: number = 5000) => {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                  try {
                    const response = await fetch(url, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    return response;
                  } catch (err) {
                    clearTimeout(timeoutId);
                    throw err;
                  }
                };

                for (let i = 0; i < allWaypoints.length - 1; i++) {
                  const fromLoc = allWaypoints[i];
                  const toLoc = allWaypoints[i + 1];

                  if (canConnectByRoad(fromLoc, toLoc)) {
                    try {
                      const segmentWaypoints = `${fromLoc.longitude},${fromLoc.latitude};${toLoc.longitude},${toLoc.latitude}`;
                      const url = `https://router.project-osrm.org/route/v1/driving/${segmentWaypoints}?overview=full&geometries=geojson`;
                      const response = await fetchWithTimeout(url, 5000);
                      const data = await response.json();

                      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                        const segmentGeometry = data.routes[0].geometry.coordinates.map(
                          (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
                        );
                        routeSegments.push({ type: 'road', geometry: segmentGeometry });
                        routeGeometry.push(...segmentGeometry);
                      } else {
                        throw new Error('Road routing failed');
                      }
                    } catch {
                      const straightLine: [number, number][] = [
                        [fromLoc.latitude, fromLoc.longitude],
                        [toLoc.latitude, toLoc.longitude],
                      ];
                      routeSegments.push({ type: 'road', geometry: straightLine });
                      routeGeometry.push(...straightLine);
                    }
                  } else {
                    const start = turf.point([fromLoc.longitude, fromLoc.latitude]);
                    const end = turf.point([toLoc.longitude, toLoc.latitude]);
                    const arc = turf.greatCircle(start, end, { npoints: 50 });
                    const arcGeometry = (arc.geometry.coordinates as number[][]).map(
                      (coord) => [coord[1], coord[0]] as [number, number]
                    );
                    routeSegments.push({ type: 'air', geometry: arcGeometry });
                    routeGeometry.push(...arcGeometry);
                  }
                }
              } else {
                // Standard OSRM road routing
                const waypoints = [
                  `${originLoc.longitude},${originLoc.latitude}`,
                  ...stopsWithCoords.map(s => `${s.coords[1]},${s.coords[0]}`),
                  `${destLoc.longitude},${destLoc.latitude}`,
                ].join(';');

                const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                let data;
                try {
                  const response = await fetch(url, { signal: controller.signal });
                  clearTimeout(timeoutId);
                  data = await response.json();
                } catch {
                  clearTimeout(timeoutId);
                  data = { code: 'Error' };
                }

                if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
                  routeGeometry = [
                    [originLoc.latitude, originLoc.longitude],
                    ...stopsWithCoords.map(s => s.coords),
                    [destLoc.latitude, destLoc.longitude],
                  ];
                  routeSegments.push({ type: 'road', geometry: routeGeometry });
                } else {
                  const route = data.routes[0];
                  routeGeometry = route.geometry.coordinates.map(
                    (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
                  );
                  routeSegments.push({ type: 'road', geometry: routeGeometry });
                }
              }
            }

            // Calculate current position using turf
            const { position, progress, bearing: initialBearing } = calculateCurrentPosition(
              routeGeometry,
              shipment.created_at,
              shipment.arrival_time
            );

            return {
              ...shipment,
              drivers: driversMap.get(String(shipment.driver_id)) || { name: 'Unknown' },
              vehicles: vehiclesMap.get(String(shipment.vehicle_id)) || { name: 'Unknown' },
              inventory: inventoryMap.get(String(shipment.inventory_item_id)) || { item_name: 'Unknown' },
              routeGeometry,
              routeSegments,
              isHybridRoute,
              originCoords: [originLoc.latitude, originLoc.longitude] as [number, number],
              destCoords: [destLoc.latitude, destLoc.longitude] as [number, number],
              currentPosition: position,
              progress,
              bearing: initialBearing,
              stops: stopsWithCoords,
            };
          } catch (err) {
            console.error('Error fetching route for shipment:', shipment.id, err);
            return null;
          }
        })
      );

      const validShipments = shipmentsWithRoutes.filter((s): s is ShipmentWithRoute => s !== null);
      setShipments(validShipments);
    } catch (err) {
      console.error('Error fetching active shipments:', err);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await fetchLocations();
      await fetchActiveShipments();
      setLoading(false);
    };

    initialize();

    // Refetch data every 30 seconds to check for new shipments or status changes
    // The animation itself runs continuously via requestAnimationFrame
    dataFetchIntervalRef.current = setInterval(() => {
      fetchActiveShipments();
    }, 30000);

    return () => {
      if (dataFetchIntervalRef.current) {
        clearInterval(dataFetchIntervalRef.current);
      }
    };
  }, []);

  const defaultCenter: [number, number] = [20.5937, 78.9629];
  const defaultZoom = 5;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-[600px] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading live tracking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          Live Fleet Tracking
        </h2>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
            <span>{shipments.length} Active Shipments</span>
          </div>
        </div>
      </div>

      <div className="h-[600px] rounded-lg overflow-hidden relative">
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapUpdater locations={locations} shipments={shipments} />

          {/* Render active shipments */}
          {shipments.map((shipment) => (
            <div key={shipment.id}>
              {/* Route polylines */}
              {shipment.isHybridRoute ? (
                shipment.routeSegments.map((segment, idx) => (
                  <Polyline
                    key={`segment-${shipment.id}-${idx}`}
                    positions={segment.geometry}
                    color={segment.type === 'air' ? '#3b82f6' : '#f59e0b'}
                    weight={segment.type === 'air' ? 3 : 4}
                    opacity={0.7}
                    dashArray={segment.type === 'air' ? '10, 10' : undefined}
                  />
                ))
              ) : (
                <Polyline
                  positions={shipment.routeGeometry}
                  color={
                    shipment.shipping_method === 'plane'
                      ? '#3b82f6'
                      : (shipment.urgency === 'express' ? '#ea580c' : '#f59e0b')
                  }
                  weight={shipment.shipping_method === 'plane' ? 3 : 4}
                  opacity={0.7}
                  dashArray={
                    shipment.shipping_method === 'plane'
                      ? '10, 10'
                      : (shipment.urgency === 'express' ? '10, 5' : undefined)
                  }
                />
              )}

              {/* Origin marker */}
              <Marker position={shipment.originCoords} icon={originIcon}>
                <Popup>
                  <div className="text-sm">
                    <h3 className="font-bold text-green-700 mb-1">Origin</h3>
                  </div>
                </Popup>
              </Marker>

              {/* Destination marker */}
              <Marker position={shipment.destCoords} icon={destinationIcon}>
                <Popup>
                  <div className="text-sm">
                    <h3 className="font-bold text-red-700 mb-1">Destination</h3>
                  </div>
                </Popup>
              </Marker>

              {/* Intermediate stop markers */}
              {shipment.stops && shipment.stops.map((stop) => (
                <Marker
                  key={`stop-${shipment.id}-${stop.id}`}
                  position={stop.coords}
                  icon={createStopIcon(stop.stop_order)}
                >
                  <Popup>
                    <div className="text-sm min-w-[150px]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
                          {stop.stop_order}
                        </div>
                        <h3 className="font-bold text-purple-700">Stop {stop.stop_order}</h3>
                      </div>
                      <p className="text-gray-800 font-medium">{stop.name}</p>
                      {stop.notes && (
                        <p className="text-gray-600 text-xs mt-1 italic">{stop.notes}</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Animated moving vehicle marker */}
              <AnimatedVehicleMarker shipment={shipment} />
            </div>
          ))}

          {/* Static location markers (when no shipments are active) */}
          {shipments.length === 0 && locations.map((location) => (
            <Marker
              key={location.id}
              position={[location.latitude, location.longitude]}
            >
              <Popup>
                <div className="text-sm">
                  <h3 className="font-bold text-gray-900 mb-1">{location.name}</h3>
                  <p className="text-gray-600 capitalize text-xs">Type: {location.type}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
