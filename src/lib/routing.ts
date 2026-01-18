import type { Location } from '@/types/database';

export interface RouteResult {
  distanceKm: number;
  durationSeconds: number;
  geometry?: any; // GeoJSON LineString for the route
}

// Geographic regions based on longitude/latitude bounds
export type GeoRegion =
  | 'north_america'
  | 'south_america'
  | 'europe'
  | 'africa'
  | 'asia'
  | 'oceania'
  | 'unknown';

interface RegionBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

const REGION_BOUNDS: Record<GeoRegion, RegionBounds> = {
  north_america: { minLat: 15, maxLat: 72, minLon: -170, maxLon: -50 },
  south_america: { minLat: -56, maxLat: 15, minLon: -82, maxLon: -34 },
  europe: { minLat: 35, maxLat: 72, minLon: -25, maxLon: 65 },
  africa: { minLat: -35, maxLat: 37, minLon: -18, maxLon: 52 },
  asia: { minLat: -10, maxLat: 77, minLon: 65, maxLon: 180 },
  oceania: { minLat: -47, maxLat: -10, minLon: 110, maxLon: 180 },
  unknown: { minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 },
};

// Regions that can be connected by road (same landmass or connected via bridges/tunnels)
const CONNECTED_REGIONS: GeoRegion[][] = [
  ['north_america'], // North America is isolated (connected to South America only via Panama)
  ['south_america'], // South America
  ['europe', 'asia', 'africa'], // Eurasian + African landmass
  ['oceania'], // Australia/NZ isolated
];

/**
 * Determine which geographic region a location belongs to
 */
export function getRegion(location: Location): GeoRegion {
  const { latitude, longitude } = location;

  // Check each region (order matters for overlapping areas)
  // North America check (prioritize for US locations)
  if (longitude >= -170 && longitude <= -50 && latitude >= 15 && latitude <= 72) {
    return 'north_america';
  }

  // South America
  if (longitude >= -82 && longitude <= -34 && latitude >= -56 && latitude < 15) {
    return 'south_america';
  }

  // Europe (before Asia due to overlap)
  if (longitude >= -25 && longitude <= 65 && latitude >= 35 && latitude <= 72) {
    return 'europe';
  }

  // Africa
  if (longitude >= -18 && longitude <= 52 && latitude >= -35 && latitude <= 37) {
    return 'africa';
  }

  // Asia
  if (longitude >= 65 && longitude <= 180 && latitude >= -10 && latitude <= 77) {
    return 'asia';
  }

  // Oceania (Australia, NZ)
  if (longitude >= 110 && longitude <= 180 && latitude >= -47 && latitude <= -10) {
    return 'oceania';
  }

  return 'unknown';
}

/**
 * Check if two locations can be connected by road (same landmass)
 */
export function canConnectByRoad(loc1: Location, loc2: Location): boolean {
  const region1 = getRegion(loc1);
  const region2 = getRegion(loc2);

  // Same region - can definitely connect by road
  if (region1 === region2) {
    return true;
  }

  // Check if regions are in the same connected landmass group
  for (const group of CONNECTED_REGIONS) {
    if (group.includes(region1) && group.includes(region2)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a route requires crossing an ocean
 */
export function requiresOceanCrossing(locations: Location[]): boolean {
  if (locations.length < 2) return false;

  for (let i = 0; i < locations.length - 1; i++) {
    if (!canConnectByRoad(locations[i], locations[i + 1])) {
      return true;
    }
  }

  return false;
}

export interface HybridRouteResult {
  totalDistanceKm: number;
  segments: HybridRouteSegment[];
  requiresAir: boolean;
}

export interface HybridRouteSegment {
  type: 'road' | 'air';
  from: Location;
  to: Location;
  distanceKm: number;
  durationSeconds?: number;
  geometry?: [number, number][]; // [lat, lon] pairs
}

/**
 * Calculate a hybrid route that uses air travel for ocean crossings
 * and road travel for ground segments
 */
export async function calculateHybridRoute(
  locations: Location[]
): Promise<HybridRouteResult> {
  if (locations.length < 2) {
    throw new Error('At least 2 locations required');
  }

  const segments: HybridRouteSegment[] = [];
  let totalDistanceKm = 0;
  let requiresAir = false;

  for (let i = 0; i < locations.length - 1; i++) {
    const from = locations[i];
    const to = locations[i + 1];

    if (canConnectByRoad(from, to)) {
      // Try road routing
      try {
        const roadRoute = await calculateRouteWithStops([from, to]);
        segments.push({
          type: 'road',
          from,
          to,
          distanceKm: roadRoute.distanceKm,
          durationSeconds: roadRoute.durationSeconds,
          geometry: roadRoute.geometry?.coordinates?.map(
            (c: [number, number]) => [c[1], c[0]] as [number, number]
          ),
        });
        totalDistanceKm += roadRoute.distanceKm;
      } catch {
        // Fallback to air if road routing fails
        const airDistance = calculateAirDistanceWithStops([from, to]);
        segments.push({
          type: 'air',
          from,
          to,
          distanceKm: airDistance,
        });
        totalDistanceKm += airDistance;
        requiresAir = true;
      }
    } else {
      // Must use air travel
      const airDistance = calculateAirDistanceWithStops([from, to]);
      segments.push({
        type: 'air',
        from,
        to,
        distanceKm: airDistance,
      });
      totalDistanceKm += airDistance;
      requiresAir = true;
    }
  }

  return {
    totalDistanceKm,
    segments,
    requiresAir,
  };
}

/**
 * Get human-readable route description for hybrid routes
 */
export function getRouteDescription(hybridRoute: HybridRouteResult): string {
  if (!hybridRoute.requiresAir) {
    return `Ground transport: ${hybridRoute.totalDistanceKm.toFixed(0)} km`;
  }

  const airSegments = hybridRoute.segments.filter(s => s.type === 'air');
  const roadSegments = hybridRoute.segments.filter(s => s.type === 'road');

  const airDistance = airSegments.reduce((sum, s) => sum + s.distanceKm, 0);
  const roadDistance = roadSegments.reduce((sum, s) => sum + s.distanceKm, 0);

  if (roadSegments.length === 0) {
    return `Air transport: ${airDistance.toFixed(0)} km`;
  }

  return `Hybrid route: ${airDistance.toFixed(0)} km by air + ${roadDistance.toFixed(0)} km by road`;
}

/**
 * Calculate route using OSRM with support for intermediate waypoints
 * @param locations Array of locations [origin, ...stops, destination]
 * @returns Route information including total distance and duration
 */
export async function calculateRouteWithStops(
  locations: Location[]
): Promise<RouteResult> {
  if (locations.length < 2) {
    throw new Error('At least 2 locations required (origin and destination)');
  }

  // Build coordinates string for OSRM: lon,lat;lon,lat;...
  const coordinates = locations
    .map(loc => `${loc.longitude},${loc.latitude}`)
    .join(';');

  // OSRM URL with all waypoints
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error('Could not calculate route distance');
  }

  const route = data.routes[0];

  return {
    distanceKm: route.distance / 1000, // Convert meters to km
    durationSeconds: route.duration,
    geometry: route.geometry, // GeoJSON LineString for map rendering
  };
}

/**
 * Calculate air distance between multiple points (for airplane routes)
 * Uses geodesic distance calculation
 */
export function calculateAirDistanceWithStops(locations: Location[]): number {
  if (locations.length < 2) {
    throw new Error('At least 2 locations required');
  }

  let totalDistance = 0;

  // Sum up distances between consecutive points
  for (let i = 0; i < locations.length - 1; i++) {
    const from = locations[i];
    const to = locations[i + 1];

    // Haversine formula for great circle distance
    const R = 6371; // Earth's radius in km
    const dLat = toRad(to.latitude - from.latitude);
    const dLon = toRad(to.longitude - from.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(from.latitude)) *
        Math.cos(toRad(to.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    totalDistance += distance;
  }

  return totalDistance;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
