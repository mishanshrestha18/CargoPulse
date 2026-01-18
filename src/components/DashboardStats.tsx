'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapPin, Truck, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Stats {
  totalLocations: number;
  activeFleet: number;
  criticalStock: number;
  completedShipments: number;
}

interface DashboardStatsProps {
  refreshTrigger?: number;
}

export default function DashboardStats({ refreshTrigger }: DashboardStatsProps) {
  const [stats, setStats] = useState<Stats>({
    totalLocations: 0,
    activeFleet: 0,
    criticalStock: 0,
    completedShipments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
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

      // Fetch completed shipments (status 'Delivered')
      const { count: completedShipmentsCount, error: shipmentsError } = await supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Delivered');

      if (shipmentsError) throw shipmentsError;

      setStats({
        totalLocations: locationsCount || 0,
        activeFleet: activeFleetCount || 0,
        criticalStock: criticalStockCount || 0,
        completedShipments: completedShipmentsCount || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  if (error) {
    return (
      <div className="mb-6 p-4 bg-red-50 text-red-800 border border-red-200 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Dashboard Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Locations Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Locations</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {loading ? '...' : stats.totalLocations}
              </p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
              <MapPin className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* Active Fleet Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Active Fleet</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {loading ? '...' : stats.activeFleet}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">In Transit</p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
              <Truck className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Critical Stock Card */}
        <div
          className={`rounded-lg shadow-md p-6 border-l-4 ${
            stats.criticalStock > 0
              ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
              : 'bg-white dark:bg-gray-800 border-yellow-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-sm font-medium mb-1 ${
                  stats.criticalStock > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Critical Stock
              </p>
              <p
                className={`text-3xl font-bold ${
                  stats.criticalStock > 0 ? 'text-red-900 dark:text-red-200' : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {loading ? '...' : stats.criticalStock}
              </p>
              <p
                className={`text-xs mt-1 ${
                  stats.criticalStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {stats.criticalStock > 0 ? 'Items below threshold' : 'Quantity < 20'}
              </p>
            </div>
            <div
              className={`p-3 rounded-full ${
                stats.criticalStock > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'
              }`}
            >
              <AlertTriangle
                className={`w-8 h-8 ${
                  stats.criticalStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Completed Shipments Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Completed Shipments</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {loading ? '...' : stats.completedShipments}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Delivered</p>
            </div>
            <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full">
              <CheckCircle className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
