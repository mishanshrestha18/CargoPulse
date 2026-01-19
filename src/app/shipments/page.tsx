'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Truck,
  Plane,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Calendar,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

interface ShipmentItem {
  id: number;
  item_name: string;
  quantity: number;
  price_per_unit: number;
  total_cost: number;
}

interface Shipment {
  id: number;
  driver_id: string;
  vehicle_id: string;
  origin: string;
  destination: string;
  quantity: number;
  arrival_time: string;
  created_at: string;
  status: string;
  urgency: string;
  shipping_method: string;
  total_cost: number;
  drivers: { name: string };
  vehicles: { name: string };
  locations_origin: { name: string };
  locations_destination: { name: string };
  inventory: { item_name: string };
  shipment_items?: ShipmentItem[];
}

type TabType = 'all' | 'active' | 'delivered' | 'cancelled';

export default function ShipmentsPage() {
  const { userRole, profile } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [currentDriverId, setCurrentDriverId] = useState<string | null>(null);

  const isDriver = userRole === 'driver';

  // Fetch driver ID for the current user if they are a driver
  useEffect(() => {
    const fetchDriverId = async () => {
      if (!isDriver || !profile) return;

      try {
        const { data: driverByEmail } = await supabase
          .from('drivers')
          .select('id')
          .eq('email', profile.email)
          .single();

        if (driverByEmail) {
          setCurrentDriverId(String(driverByEmail.id));
          return;
        }

        if (profile.full_name) {
          const { data: driverByName } = await supabase
            .from('drivers')
            .select('id')
            .eq('name', profile.full_name)
            .single();

          if (driverByName) {
            setCurrentDriverId(String(driverByName.id));
          }
        }
      } catch (err) {
        console.error('Error fetching driver ID:', err);
      }
    };

    fetchDriverId();
  }, [isDriver, profile]);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query based on active tab
      let query = supabase
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by status based on tab
      if (activeTab === 'active') {
        query = query.eq('status', 'In Transit');
      } else if (activeTab === 'delivered') {
        query = query.eq('status', 'Delivered');
      } else if (activeTab === 'cancelled') {
        query = query.eq('status', 'Cancelled');
      }

      const { data: shipmentsData, error: shipmentsError } = await query;

      if (shipmentsError) throw shipmentsError;

      // Fetch related data
      const [driversRes, vehiclesRes, locationsRes, inventoryRes] = await Promise.all([
        supabase.from('drivers').select('id, name'),
        supabase.from('vehicles').select('id, name'),
        supabase.from('locations').select('id, name'),
        supabase.from('inventory').select('id, item_name'),
      ]);

      // Create lookup maps
      const driversMap = new Map(driversRes.data?.map(d => [String(d.id), d]) || []);
      const vehiclesMap = new Map(vehiclesRes.data?.map(v => [String(v.id), v]) || []);
      const locationsMap = new Map(locationsRes.data?.map(l => [String(l.id), l]) || []);
      const inventoryMap = new Map(inventoryRes.data?.map(i => [String(i.id), i]) || []);

      // Fetch shipment items
      const shipmentIds = shipmentsData?.map(s => s.id) || [];
      const { data: allShipmentItems } = await supabase
        .from('shipment_items')
        .select('*')
        .in('shipment_id', shipmentIds);

      const shipmentItemsMap = new Map<string, ShipmentItem[]>();
      (allShipmentItems || []).forEach(item => {
        const shipmentId = String(item.shipment_id);
        if (!shipmentItemsMap.has(shipmentId)) {
          shipmentItemsMap.set(shipmentId, []);
        }
        const invItem = inventoryMap.get(String(item.inventory_item_id));
        shipmentItemsMap.get(shipmentId)!.push({
          ...item,
          item_name: invItem?.item_name || item.item_name || 'Unknown',
        });
      });

      // Map the data
      let mappedShipments = (shipmentsData || []).map((shipment: any) => ({
        ...shipment,
        drivers: driversMap.get(String(shipment.driver_id)) || { name: 'Unknown' },
        vehicles: vehiclesMap.get(String(shipment.vehicle_id)) || { name: 'Unknown' },
        locations_origin: locationsMap.get(String(shipment.origin)) || { name: 'Unknown' },
        locations_destination: locationsMap.get(String(shipment.destination)) || { name: 'Unknown' },
        inventory: inventoryMap.get(String(shipment.inventory_item_id)) || { item_name: 'Unknown' },
        shipment_items: shipmentItemsMap.get(String(shipment.id)) || [],
      }));

      // Filter for driver role
      if (isDriver && currentDriverId) {
        mappedShipments = mappedShipments.filter(
          (shipment: Shipment) => String(shipment.driver_id) === currentDriverId
        );
      }

      setShipments(mappedShipments);
    } catch (err) {
      console.error('Error fetching shipments:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch shipments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [activeTab, currentDriverId, isDriver]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      'In Transit': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'Delivered': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'Cancelled': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'Pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    };

    const icons: Record<string, any> = {
      'In Transit': <TrendingUp className="w-3 h-3" />,
      'Delivered': <CheckCircle className="w-3 h-3" />,
      'Cancelled': <XCircle className="w-3 h-3" />,
      'Pending': <Clock className="w-3 h-3" />,
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
      minute: '2-digit',
    });
  };

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'all', label: 'All Shipments', icon: Package },
    { key: 'active', label: 'In Transit', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle },
    { key: 'cancelled', label: 'Cancelled', icon: XCircle },
  ];

  // Calculate counts for each status
  const statusCounts = {
    all: shipments.length,
    active: shipments.filter(s => s.status === 'In Transit').length,
    delivered: shipments.filter(s => s.status === 'Delivered').length,
    cancelled: shipments.filter(s => s.status === 'Cancelled').length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-7 h-7" />
            {isDriver ? 'My Shipments' : 'All Shipments'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {isDriver ? 'View your shipment history' : 'Manage and track all shipments'}
          </p>
        </div>
        <button
          onClick={fetchShipments}
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

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4 -mb-px">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.key === 'all' && (
                  <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700">
                    {statusCounts[tab.key]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
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
            No shipments found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {activeTab === 'all'
              ? "There are no shipments to display."
              : activeTab === 'active'
              ? "No shipments are currently in transit."
              : activeTab === 'delivered'
              ? "No delivered shipments yet."
              : "No cancelled shipments."}
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
                  <div className={`p-3 rounded-lg ${
                    shipment.shipping_method === 'plane'
                      ? 'bg-purple-100 dark:bg-purple-900/30'
                      : 'bg-blue-100 dark:bg-blue-900/30'
                  }`}>
                    {shipment.shipping_method === 'plane' ? (
                      <Plane className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    ) : (
                      <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Shipment #{shipment.id}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {shipment.vehicles?.name || 'Unknown Vehicle'} • {shipment.drivers?.name || 'Unknown Driver'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {shipment.urgency === 'express' && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full text-xs font-semibold">
                      Express
                    </span>
                  )}
                  {getStatusBadge(shipment.status)}
                </div>
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
                      {shipment.locations_origin?.name || 'Unknown'}
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
                      {shipment.locations_destination?.name || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cargo Info */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Cargo</p>
                {shipment.shipment_items && shipment.shipment_items.length > 0 ? (
                  <div className="space-y-1">
                    {shipment.shipment_items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">
                          {item.quantity}x {item.item_name}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          ${item.total_cost?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {shipment.quantity}x {shipment.inventory?.item_name || 'Unknown item'}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm">
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>Created: {formatDate(shipment.created_at)}</span>
                </div>
                {shipment.arrival_time && (
                  <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>
                      {shipment.status === 'Delivered' ? 'Delivered' : 'ETA'}: {formatDate(shipment.arrival_time)}
                    </span>
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
