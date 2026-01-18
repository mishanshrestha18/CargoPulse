'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { supabase } from '@/lib/supabase';
import type { Location, Vehicle } from '@/types/database';
import L from 'leaflet';
import { Search, X, Navigation, DollarSign, Clock, MapPin } from 'lucide-react';

interface WeatherData {
  temperature: number;
  windspeed: number;
  weathercode: number;
}

interface SearchablePoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'warehouse' | 'port' | 'vehicle';
}

interface RouteData {
  coordinates: [number, number][];
  distance: number; // in meters
  duration: number; // in seconds
}

interface RoutePlan {
  origin: SearchablePoint;
  destination: SearchablePoint;
  stops?: SearchablePoint[]; // Optional intermediate stops
  route: RouteData;
}

// Fix default marker icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const createCustomIcon = (color: string, label: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-weight: bold;
          font-size: 16px;
          margin-bottom: 4px;
        ">${label}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
};

const originIcon = createCustomIcon('#10b981', 'A');
const destinationIcon = createCustomIcon('#ef4444', 'B');

// Create numbered stop icons for intermediate waypoints
const createStopIcon = (stopNumber: number) => {
  return createCustomIcon('#3b82f6', stopNumber.toString());
};

// Sub-component to handle map auto-zoom
function MapUpdater({ locations, routePlan }: { locations: Location[]; routePlan: RoutePlan | null }) {
  const map = useMap();

  useEffect(() => {
    if (routePlan) {
      // Zoom to show the entire route
      const bounds = L.latLngBounds(routePlan.route.coordinates);
      map.fitBounds(bounds, { padding: [100, 100] });
    } else if (locations.length > 0) {
      const bounds = L.latLngBounds(
        locations.map(loc => [loc.latitude, loc.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, routePlan, map]);

  return null;
}

export default function Map() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [weatherData, setWeatherData] = useState<{ [key: string]: WeatherData | null }>({});
  const [weatherLoading, setWeatherLoading] = useState<{ [key: string]: boolean }>({});

  // Route Planning State
  const [planningMode, setPlanningMode] = useState(false);
  const [searchablePoints, setSearchablePoints] = useState<SearchablePoint[]>([]);
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState<SearchablePoint | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<SearchablePoint | null>(null);
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (err) {
      console.error('Error fetching locations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (err) {
      console.error('Error fetching vehicles:', err);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchVehicles();
  }, []);

  // Build searchable points from locations and vehicles
  useEffect(() => {
    const points: SearchablePoint[] = [
      ...locations.map(loc => ({
        id: loc.id,
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        type: loc.type as 'warehouse' | 'port',
      })),
      // Note: Vehicles don't have coordinates in your schema, so we'll skip them
      // If you want to add vehicles, you'd need to add lat/lon fields to the Vehicle table
    ];
    setSearchablePoints(points);
  }, [locations, vehicles]);

  const fetchWeather = async (locationId: string, latitude: number, longitude: number) => {
    setWeatherLoading(prev => ({ ...prev, [locationId]: true }));

    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
      );

      if (!response.ok) throw new Error('Failed to fetch weather data');

      const data = await response.json();

      setWeatherData(prev => ({
        ...prev,
        [locationId]: {
          temperature: data.current_weather.temperature,
          windspeed: data.current_weather.windspeed,
          weathercode: data.current_weather.weathercode,
        }
      }));
    } catch (err) {
      console.error('Error fetching weather:', err);
      setWeatherData(prev => ({ ...prev, [locationId]: null }));
    } finally {
      setWeatherLoading(prev => ({ ...prev, [locationId]: false }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this location?')) return;

    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Refresh the map
      await fetchLocations();
    } catch (err) {
      console.error('Error deleting location:', err);
      alert('Failed to delete location');
    }
  };

  // Fetch route from OSRM
  const fetchRoute = async (origin: SearchablePoint, destination: SearchablePoint) => {
    setRouteLoading(true);
    setRouteError(null);

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch route from OSRM');
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }

      const route = data.routes[0];
      const coordinates: [number, number][] = route.geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]] // GeoJSON is [lon, lat], Leaflet uses [lat, lon]
      );

      const routeData: RouteData = {
        coordinates,
        distance: route.distance, // in meters
        duration: route.duration, // in seconds
      };

      setRoutePlan({
        origin,
        destination,
        route: routeData,
      });
    } catch (err) {
      console.error('Error fetching route:', err);
      setRouteError(err instanceof Error ? err.message : 'Failed to calculate route');
      setRoutePlan(null);
    } finally {
      setRouteLoading(false);
    }
  };

  // Calculate cost
  const calculateCost = (distanceKm: number, durationHours: number) => {
    const DRIVER_COST_PER_HOUR = 30;
    const FUEL_COST_PER_KM = 1.50;

    const driverCost = durationHours * DRIVER_COST_PER_HOUR;
    const fuelCost = distanceKm * FUEL_COST_PER_KM;

    return {
      driverCost,
      fuelCost,
      totalCost: driverCost + fuelCost,
    };
  };

  // Handle origin/destination selection
  useEffect(() => {
    if (selectedOrigin && selectedDestination) {
      fetchRoute(selectedOrigin, selectedDestination);
    } else {
      setRoutePlan(null);
    }
  }, [selectedOrigin, selectedDestination]);

  // Filter searchable points based on query
  const filterPoints = (query: string) => {
    if (!query.trim()) return [];
    return searchablePoints.filter(point =>
      point.name.toLowerCase().includes(query.toLowerCase())
    );
  };

  const originSuggestions = filterPoints(originQuery);
  const destinationSuggestions = filterPoints(destinationQuery);

  // Clear route plan
  const clearRoutePlan = () => {
    setOriginQuery('');
    setDestinationQuery('');
    setSelectedOrigin(null);
    setSelectedDestination(null);
    setRoutePlan(null);
    setRouteError(null);
  };

  // Default center
  const defaultCenter: [number, number] = [20.5937, 78.9629];
  const defaultZoom = 5;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-[600px] flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading map...</p>
      </div>
    );
  }

  // Create route coordinates from locations (existing feature)
  const routeCoordinates: [number, number][] = locations.map(loc => [loc.latitude, loc.longitude]);

  // Format distance and duration
  const formatDistance = (meters: number) => {
    const km = meters / 1000;
    return `${km.toFixed(1)}km`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Live Route Map</h2>
        <button
          onClick={() => {
            setPlanningMode(!planningMode);
            if (planningMode) clearRoutePlan();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            planningMode
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <Navigation className="h-5 w-5" />
          {planningMode ? 'Exit Planning Mode' : 'Route Planner'}
        </button>
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

          {/* Auto-zoom to fit all markers or route */}
          <MapUpdater locations={locations} routePlan={routePlan} />

          {/* Draw existing route line connecting all locations (only when not in planning mode) */}
          {!planningMode && routeCoordinates.length > 1 && (
            <Polyline
              positions={routeCoordinates}
              color="red"
              dashArray="5, 5"
              weight={3}
            />
          )}

          {/* Draw planned route */}
          {routePlan && (
            <>
              <Polyline
                positions={routePlan.route.coordinates}
                color="#3b82f6"
                weight={5}
                opacity={0.8}
              />
              {/* Origin marker */}
              <Marker
                position={[routePlan.origin.latitude, routePlan.origin.longitude]}
                icon={originIcon}
              >
                <Popup>
                  <div className="text-sm">
                    <h3 className="font-bold text-green-700 mb-1">Origin (A)</h3>
                    <p className="text-gray-900">{routePlan.origin.name}</p>
                  </div>
                </Popup>
              </Marker>

              {/* Intermediate stop markers */}
              {routePlan.stops && routePlan.stops.map((stop, index) => (
                <Marker
                  key={`stop-${index}`}
                  position={[stop.latitude, stop.longitude]}
                  icon={createStopIcon(index + 1)}
                >
                  <Popup>
                    <div className="text-sm">
                      <h3 className="font-bold text-blue-700 mb-1">Stop {index + 1}</h3>
                      <p className="text-gray-900">{stop.name}</p>
                      <p className="text-xs text-gray-500 mt-1 capitalize">{stop.type}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Destination marker */}
              <Marker
                position={[routePlan.destination.latitude, routePlan.destination.longitude]}
                icon={destinationIcon}
              >
                <Popup>
                  <div className="text-sm">
                    <h3 className="font-bold text-red-700 mb-1">Destination (B)</h3>
                    <p className="text-gray-900">{routePlan.destination.name}</p>
                  </div>
                </Popup>
              </Marker>
            </>
          )}

          {/* Render location markers (only when not showing route plan) */}
          {!routePlan && locations.map((location) => (
            <Marker
              key={location.id}
              position={[location.latitude, location.longitude]}
              eventHandlers={{
                popupopen: () => {
                  if (!weatherData[location.id] && !weatherLoading[location.id]) {
                    fetchWeather(location.id, location.latitude, location.longitude);
                  }
                }
              }}
            >
              <Popup>
                <div className="text-sm">
                  <h3 className="font-bold text-gray-900 mb-2">{location.name}</h3>
                  <p className="text-gray-600 capitalize">Type: {location.type}</p>
                  <p className="text-gray-500 text-xs font-mono mb-3">
                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </p>

                  <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
                    <p className="font-semibold text-blue-900 text-xs mb-1">Current Weather</p>
                    {weatherLoading[location.id] ? (
                      <p className="text-gray-600 text-xs">Loading weather...</p>
                    ) : weatherData[location.id] ? (
                      <div className="text-xs text-gray-700">
                        <p className="font-medium">🌡️ {weatherData[location.id]!.temperature}°C</p>
                        <p className="font-medium">💨 {weatherData[location.id]!.windspeed} km/h</p>
                      </div>
                    ) : weatherData[location.id] === null ? (
                      <p className="text-red-600 text-xs">Failed to load weather</p>
                    ) : null}
                  </div>

                  <button
                    onClick={() => handleDelete(location.id)}
                    className="text-red-600 hover:text-red-800 text-xs font-semibold transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Route Planning Control Panel */}
        {planningMode && (
          <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-96 z-[1000] border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Navigation className="h-5 w-5 text-blue-600" />
                Route Planner
              </h3>
              <button
                onClick={clearRoutePlan}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Clear route"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Origin Input */}
            <div className="mb-4 relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <MapPin className="h-4 w-4 inline mr-1 text-green-600" />
                Origin
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={selectedOrigin ? selectedOrigin.name : originQuery}
                  onChange={(e) => {
                    setOriginQuery(e.target.value);
                    setSelectedOrigin(null);
                  }}
                  placeholder="Search origin..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
              {/* Origin suggestions */}
              {originQuery && !selectedOrigin && originSuggestions.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                  {originSuggestions.map((point) => (
                    <button
                      key={point.id}
                      onClick={() => {
                        setSelectedOrigin(point);
                        setOriginQuery(point.name);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm text-gray-800 dark:text-gray-200"
                    >
                      <div className="font-medium">{point.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{point.type}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Destination Input */}
            <div className="mb-4 relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <MapPin className="h-4 w-4 inline mr-1 text-red-600" />
                Destination
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={selectedDestination ? selectedDestination.name : destinationQuery}
                  onChange={(e) => {
                    setDestinationQuery(e.target.value);
                    setSelectedDestination(null);
                  }}
                  placeholder="Search destination..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
              {/* Destination suggestions */}
              {destinationQuery && !selectedDestination && destinationSuggestions.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                  {destinationSuggestions.map((point) => (
                    <button
                      key={point.id}
                      onClick={() => {
                        setSelectedDestination(point);
                        setDestinationQuery(point.name);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm text-gray-800 dark:text-gray-200"
                    >
                      <div className="font-medium">{point.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{point.type}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Loading State */}
            {routeLoading && (
              <div className="text-center py-4">
                <p className="text-gray-600 dark:text-gray-400 text-sm">Calculating route...</p>
              </div>
            )}

            {/* Error State */}
            {routeError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                <p className="text-red-700 dark:text-red-400 text-sm">{routeError}</p>
              </div>
            )}

            {/* Route Summary */}
            {routePlan && !routeLoading && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-3 text-sm">Route Summary</h4>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Distance:</span>
                    <span>{formatDistance(routePlan.route.distance)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Duration:</span>
                    <span>{formatDuration(routePlan.route.duration)}</span>
                  </div>

                  <div className="border-t border-blue-200 dark:border-blue-700 pt-2 mt-2">
                    <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-semibold">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span>Est. Cost:</span>
                      <span className="text-green-600 dark:text-green-400">
                        ${calculateCost(
                          routePlan.route.distance / 1000,
                          routePlan.route.duration / 3600
                        ).totalCost.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-6">
                      Driver: ${calculateCost(
                        routePlan.route.distance / 1000,
                        routePlan.route.duration / 3600
                      ).driverCost.toFixed(2)} • Fuel: ${calculateCost(
                        routePlan.route.distance / 1000,
                        routePlan.route.duration / 3600
                      ).fuelCost.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
