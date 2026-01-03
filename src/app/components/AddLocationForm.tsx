'use client';

import { useState, FormEvent } from 'react';
import { MapPin, Loader2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { LocationInsert } from '@/types/database';

export default function AddLocationForm() {
  const [name, setName] = useState('');
  const [type, setType] = useState<'warehouse' | 'port'>('warehouse');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSearch = async () => {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Please enter a location name to search' });
      return;
    }

    setSearching(true);
    setMessage(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}`
      );

      if (!response.ok) throw new Error('Failed to fetch location data');

      const data = await response.json();

      if (data.length === 0) {
        setMessage({ type: 'error', text: 'No results found. Try a different search term.' });
        return;
      }

      // Get the first result
      const result = data[0];
      setLatitude(result.lat);
      setLongitude(result.lon);
      setMessage({ type: 'success', text: `Found: ${result.display_name}` });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to search location'
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const newLocation: LocationInsert = {
        name,
        type,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      };

      const { error } = await supabase
        .from('locations')
        .insert([newLocation]);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Location added successfully!' });

      // Reset form
      setName('');
      setType('warehouse');
      setLatitude('');
      setLongitude('');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to add location'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center gap-2 mb-6">
        <MapPin className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-800">Add Location</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-800 mb-1">
            Location Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="flex-1 px-3 py-2 border border-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="Enter location name"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
              title={searching ? "Searching..." : "Search for location"}
            >
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                {searching ? "Searching..." : "Search"}
              </span>
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-800 mb-1">
            Type
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as 'warehouse' | 'port')}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          >
            <option value="warehouse">Warehouse</option>
            <option value="port">Port</option>
          </select>
        </div>

        <div>
          <label htmlFor="latitude" className="block text-sm font-medium text-gray-700 mb-1">
            Latitude
          </label>
          <input
            type="number"
            id="latitude"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            step="any"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            placeholder="e.g., 40.7128"
          />
        </div>

        <div>
          <label htmlFor="longitude" className="block text-sm font-medium text-gray-700 mb-1">
            Longitude
          </label>
          <input
            type="number"
            id="longitude"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            step="any"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            placeholder="e.g., -74.0060"
          />
        </div>

        {message && (
          <div
            className={`p-3 rounded-md ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Adding...
            </>
          ) : (
            'Add Location'
          )}
        </button>
      </form>
    </div>
  );
}
