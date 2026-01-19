'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Truck,
  Package,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Navigation,
  Calendar,
  DollarSign
} from 'lucide-react';

interface Shipment {
  id: number;
  status: string;
  origin: string;
  destination: string;
  vehicle_id: number;
  driver_id: number;
  departure_time: string;
  arrival_time: string;
  total_cost: number;
  created_at: string;
  shipping_method: string;
  origin_location?: { name: string };
  destination_location?: { name: string };
  vehicle?: { name: string };
}

export default function MyTasksPage() {
  const { user, profile } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    if (profile?.id) {
      fetchMyShipments();
    }
  }, [profile?.id, filter]);

  const fetchMyShipments = async () => {
    if (!profile?.id) return;

    setLoading(true);
    setError(null);

    try {
      // First find the driver record for this user
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('id')
        .eq('email', profile.email)
        .single();

      if (driverError || !driverData) {
        // Try matching by name if email doesn't work
        const { data: driverByName, error: nameError } = await supabase
          .from('drivers')
          .select('id')
          .eq('name', profile.full_name)
          .single();

        if (nameError || !driverByName) {
          setShipments([]);
          setLoading(false);
          return;
        }

        // Fetch shipments for this driver
        await fetchShipmentsForDriver(driverByName.id);
        return;
      }

      await fetchShipmentsForDriver(driverData.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchShipmentsForDriver = async (driverId: number) => {
    let query = supabase
      .from('shipments')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    // Apply status filter
    if (filter === 'active') {
      query = query.in('status', ['Pending', 'In Transit']);
    } else if (filter === 'completed') {
      query = query.eq('status', 'Delivered');
    }

    const { data: shipmentsData, error: shipmentsError } = await query;

    if (shipmentsError) throw shipmentsError;

    // Fetch related data separately
    const [locationsRes, vehiclesRes] = await Promise.all([
      supabase.from('locations').select('id, name'),
      supabase.from('vehicles').select('id, name'),
    ]);

    // Create lookup maps
    const locationsMap = new Map(locationsRes.data?.map(l => [String(l.id), l]) || []);
    const vehiclesMap = new Map(vehiclesRes.data?.map(v => [String(v.id), v]) || []);

    // Map the data
    const mappedShipments = (shipmentsData || []).map((shipment: any) => ({
      ...shipment,
      origin_location: locationsMap.get(String(shipment.origin)) || { name: 'Unknown' },
      destination_location: locationsMap.get(String(shipment.destination)) || { name: 'Unknown' },
      vehicle: vehiclesMap.get(String(shipment.vehicle_id)) || { name: 'Unknown' },
    }));

    setShipments(mappedShipments);
  };

  const getStatusBadge = (status: string) => {
    const styles: { [key: string]: string } = {
      'Pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'In Transit': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'Delivered': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'Cancelled': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };

    const icons: { [key: string]: any } = {
      'Pending': <Clock className="w-3 h-3" />,
      'In Transit': <Navigation className="w-3 h-3" />,
      'Delivered': <CheckCircle className="w-3 h-3" />,
      'Cancelled': <AlertCircle className="w-3 h-3" />,
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {icons[status]}
        {status}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="w-7 h-7" />
            My Tasks
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View and track your assigned shipments
          </p>
        </div>
        <button
          onClick={fetchMyShipments}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2">
        {(['all', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Shipments List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : shipments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No tasks found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {filter === 'all'
              ? "You don't have any assigned shipments yet."
              : filter === 'active'
              ? "You don't have any active shipments."
              : "You haven't completed any shipments yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {shipments.map((shipment) => (
            <div
              key={shipment.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                    <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Shipment #{shipment.id}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {shipment.vehicle?.name || 'Unknown Vehicle'}
                    </p>
                  </div>
                </div>
                {getStatusBadge(shipment.status)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Origin */}
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Origin</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {shipment.origin_location?.name || 'Unknown'}
                    </p>
                  </div>
                </div>

                {/* Destination */}
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Destination</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {shipment.destination_location?.name || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm">
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>Created: {formatDate(shipment.created_at)}</span>
                </div>
                {shipment.departure_time && (
                  <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>Departure: {formatDate(shipment.departure_time)}</span>
                  </div>
                )}
                {shipment.total_cost && (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <DollarSign className="w-4 h-4" />
                    <span>${shipment.total_cost.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
