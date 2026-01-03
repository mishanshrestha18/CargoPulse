'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { supabase } from '@/lib/supabase';
import type { Location } from '@/types/database';
import L from 'leaflet';

interface WeatherData {
  temperature: number;
  windspeed: number;
  weathercode: number;
}

// Fix default marker icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Sub-component to handle map auto-zoom
function MapUpdater({ locations }: { locations: Location[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(
        locations.map(loc => [loc.latitude, loc.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, map]);

  return null;
}

export default function Map() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [weatherData, setWeatherData] = useState<{ [key: string]: WeatherData | null }>({});
  const [weatherLoading, setWeatherLoading] = useState<{ [key: string]: boolean }>({});

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

  useEffect(() => {
    fetchLocations();
  }, []);

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

  // Default center (you can adjust this)
  const defaultCenter: [number, number] = [20.5937, 78.9629]; // India center
  const defaultZoom = 5;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 h-[600px] flex items-center justify-center">
        <p className="text-gray-500">Loading map...</p>
      </div>
    );
  }

  // Create route coordinates from locations
  const routeCoordinates: [number, number][] = locations.map(loc => [loc.latitude, loc.longitude]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Live Route Map</h2>
      <div className="h-[600px] rounded-lg overflow-hidden">
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

          {/* Auto-zoom to fit all markers */}
          <MapUpdater locations={locations} />

          {/* Draw route line connecting all locations */}
          {routeCoordinates.length > 1 && (
            <Polyline
              positions={routeCoordinates}
              color="red"
              dashArray="5, 5"
              weight={3}
            />
          )}

          {/* Render markers */}
          {locations.map((location) => (
            <Marker
              key={location.id}
              position={[location.latitude, location.longitude]}
              eventHandlers={{
                popupopen: () => {
                  // Fetch weather data when popup opens
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

                  {/* Weather Information */}
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
      </div>
    </div>
  );
}
