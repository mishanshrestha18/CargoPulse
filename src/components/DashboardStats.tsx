'use client';

import { useEffect, useState } from 'react';
import { MapPin, Truck, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Stats {
  totalLocations: number;
  activeFleet: number;
  criticalStock: number;
}

export default function DashboardStats() {
  const [stats, setStats] = useState<Stats>({
    totalLocations: 0,
    activeFleet: 0,
    criticalStock: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch total locations
      const { count: locationsCount, error: locationsError } = await supabase
        .from('locations')
        .select('*', { count: 'exact', head: true });

      if (locationsError) throw locationsError;

      // Fetch active fleet (vehicles with status 'In Transit')
      const { count: activeFleetCount, error: fleetError } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'In Transit');

      if (fleetError) throw fleetError;

      // Fetch critical stock (inventory items with quantity < 20)
      const { count: criticalStockCount, error: stockError } = await supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .lt('quantity', 20);

      if (stockError) throw stockError;

      setStats({
        totalLocations: locationsCount || 0,
        activeFleet: activeFleetCount || 0,
        criticalStock: criticalStockCount || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (error) {
    return (
      <div className="mb-6 p-4 bg-red-50 text-red-800 border border-red-200 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard Overview</h2>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Locations Card */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Locations</p>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? '...' : stats.totalLocations}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <MapPin className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Active Fleet Card */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Active Fleet</p>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? '...' : stats.activeFleet}
              </p>
              <p className="text-xs text-gray-500 mt-1">In Transit</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Truck className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Critical Stock Card */}
        <div
          className={`rounded-lg shadow-md p-6 border-l-4 ${
            stats.criticalStock > 0
              ? 'bg-red-50 border-red-500'
              : 'bg-white border-yellow-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-sm font-medium mb-1 ${
                  stats.criticalStock > 0 ? 'text-red-700' : 'text-gray-600'
                }`}
              >
                Critical Stock
              </p>
              <p
                className={`text-3xl font-bold ${
                  stats.criticalStock > 0 ? 'text-red-900' : 'text-gray-900'
                }`}
              >
                {loading ? '...' : stats.criticalStock}
              </p>
              <p
                className={`text-xs mt-1 ${
                  stats.criticalStock > 0 ? 'text-red-600' : 'text-gray-500'
                }`}
              >
                {stats.criticalStock > 0 ? 'Items below threshold' : 'Quantity < 20'}
              </p>
            </div>
            <div
              className={`p-3 rounded-full ${
                stats.criticalStock > 0 ? 'bg-red-100' : 'bg-yellow-100'
              }`}
            >
              <AlertTriangle
                className={`w-8 h-8 ${
                  stats.criticalStock > 0 ? 'text-red-600' : 'text-yellow-600'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
