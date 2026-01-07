'use client';

import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { RefreshCw, TrendingUp, Award } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Vehicle, Inventory } from '@/types/database';

interface FleetStatusData {
  name: string;
  value: number;
}

interface InventoryData {
  name: string;
  quantity: number;
}

interface RevenueData {
  month: string;
  revenue: number;
}

interface DriverPerformanceData {
  name: string;
  deliveries: number;
  totalRevenue: number;
}

const FLEET_COLORS = {
  'In Transit': '#10b981', // Green
  'Idle': '#fbbf24', // Yellow
  'Maintenance': '#ef4444', // Red
};

const AIRPLANE_COLORS = {
  'In Transit': '#06b6d4', // Cyan
  'Idle': '#fbbf24', // Yellow
  'Maintenance': '#ef4444', // Red
};

// Custom tooltip for currency formatting
const CurrencyTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-lg shadow-lg">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {payload[0].payload.month}
        </p>
        <p className="text-sm text-green-600 dark:text-green-400 font-medium">
          Revenue: ${payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export default function DashboardCharts() {
  const [fleetData, setFleetData] = useState<FleetStatusData[]>([]);
  const [airplaneData, setAirplaneData] = useState<FleetStatusData[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryData[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [driverPerformance, setDriverPerformance] = useState<DriverPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all vehicles
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*');

      if (vehiclesError) throw vehiclesError;

      // Fetch all inventory items
      const { data: inventory, error: inventoryError } = await supabase
        .from('inventory')
        .select('*');

      if (inventoryError) throw inventoryError;

      // Fetch shipments for revenue and driver performance
      const { data: shipments, error: shipmentsError } = await supabase
        .from('shipments')
        .select('*, drivers(name)')
        .eq('status', 'Delivered');

      if (shipmentsError) throw shipmentsError;

      // Process Fleet Status Data (trucks only - exclude planes)
      const fleetStatusCounts: { [key: string]: number } = {
        'In Transit': 0,
        'Idle': 0,
        'Maintenance': 0,
      };

      const airplaneStatusCounts: { [key: string]: number } = {
        'In Transit': 0,
        'Idle': 0,
        'Maintenance': 0,
      };

      vehicles?.forEach((vehicle: Vehicle) => {
        const vehicleType = (vehicle.type || '').toLowerCase().trim();
        if (vehicleType === 'plane') {
          airplaneStatusCounts[vehicle.status] = (airplaneStatusCounts[vehicle.status] || 0) + 1;
        } else {
          fleetStatusCounts[vehicle.status] = (fleetStatusCounts[vehicle.status] || 0) + 1;
        }
      });

      const processedFleetData = Object.entries(fleetStatusCounts).map(([name, value]) => ({
        name,
        value,
      }));

      const processedAirplaneData = Object.entries(airplaneStatusCounts).map(([name, value]) => ({
        name,
        value,
      }));

      setFleetData(processedFleetData);
      setAirplaneData(processedAirplaneData);

      // Process Inventory Data - Top 5 by quantity
      const sortedInventory = (inventory || [])
        .sort((a: Inventory, b: Inventory) => b.quantity - a.quantity)
        .slice(0, 5)
        .map((item: Inventory) => ({
          name: item.item_name,
          quantity: item.quantity,
        }));

      setInventoryData(sortedInventory);

      // Process Revenue Trends - Last 6 months from actual shipments
      const now = new Date();
      const monthsData: { [key: string]: number } = {};

      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
        monthsData[monthKey] = 0;
      }

      shipments?.forEach((shipment: any) => {
        const shipmentDate = new Date(shipment.created_at);
        const monthKey = shipmentDate.toLocaleDateString('en-US', { month: 'short' });
        if (monthsData.hasOwnProperty(monthKey)) {
          monthsData[monthKey] += shipment.total_cost || 0;
        }
      });

      const processedRevenueData = Object.entries(monthsData).map(([month, revenue]) => ({
        month,
        revenue: Math.round(revenue),
      }));

      setRevenueData(processedRevenueData);

      // Process Driver Performance - Top 5 by deliveries and revenue
      const driverStats: { [key: string]: { deliveries: number; totalRevenue: number } } = {};

      shipments?.forEach((shipment: any) => {
        const driverData = shipment.drivers as any;
        const driverName = driverData?.name || 'Unknown';

        if (!driverStats[driverName]) {
          driverStats[driverName] = { deliveries: 0, totalRevenue: 0 };
        }

        driverStats[driverName].deliveries += 1;
        driverStats[driverName].totalRevenue += shipment.total_cost || 0;
      });

      const processedDriverPerformance = Object.entries(driverStats)
        .map(([name, stats]) => ({
          name,
          deliveries: stats.deliveries,
          totalRevenue: Math.round(stats.totalRevenue),
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5);

      setDriverPerformance(processedDriverPerformance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chart data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds for real-time updates
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Analytics</h2>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* First Row - Fleet & Airplane Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Fleet Status Pie Chart (Trucks) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Fleet Status (Trucks)</h3>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : fleetData.every(d => d.value === 0) ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">No fleet data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={fleetData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) =>
                    value > 0 ? `${name}: ${value} (${(percent * 100).toFixed(0)}%)` : ''
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {fleetData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={FLEET_COLORS[entry.name as keyof typeof FLEET_COLORS]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Airplane Status Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Airplane Status</h3>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : airplaneData.every(d => d.value === 0) ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">No airplane data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={airplaneData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) =>
                    value > 0 ? `${name}: ${value} (${(percent * 100).toFixed(0)}%)` : ''
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {airplaneData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={AIRPLANE_COLORS[entry.name as keyof typeof AIRPLANE_COLORS]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top 5 Inventory Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Top 5 Inventory Items</h3>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : inventoryData.length === 0 ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">No inventory data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={inventoryData}
                margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tickFormatter={(value) => value.length > 10 ? `${value.slice(0, 10)}...` : value}
                  stroke="#6b7280"
                />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  formatter={(value, name, props) => [value, 'Quantity']}
                  labelFormatter={(label) => inventoryData.find(d => d.name.startsWith(label.slice(0, 10)))?.name || label}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="quantity" fill="#3b82f6" name="Quantity" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 dark:border-gray-700 my-6"></div>

      {/* Second Row - Revenue Trends & Driver Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue Trends Area Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Revenue Trends (Real-Time)</h3>
          </div>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : revenueData.length === 0 || revenueData.every(d => d.revenue === 0) ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">No revenue data available</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart
                  data={revenueData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    stroke="#6b7280"
                    style={{ fontSize: '14px' }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    style={{ fontSize: '14px' }}
                    tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`}
                  />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    name="Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total (6 months)</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    ${revenueData.reduce((sum, item) => sum + item.revenue, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Top Driver Performance Horizontal Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Top Driver Performance (Real-Time)</h3>
          </div>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : driverPerformance.length === 0 ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">No driver performance data available</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={driverPerformance}
                  layout="horizontal"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    stroke="#6b7280"
                    style={{ fontSize: '14px' }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#6b7280"
                    style={{ fontSize: '14px' }}
                    width={90}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'Revenue') return [`$${value.toLocaleString()}`, 'Revenue'];
                      return [value, 'Deliveries'];
                    }}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar
                    dataKey="totalRevenue"
                    fill="#3b82f6"
                    name="Revenue"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Total Deliveries</span>
                    <p className="font-semibold text-blue-600 dark:text-blue-400 text-lg">
                      {driverPerformance.reduce((sum, driver) => sum + driver.deliveries, 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Total Revenue</span>
                    <p className="font-semibold text-green-600 dark:text-green-400 text-lg">
                      ${driverPerformance.reduce((sum, driver) => sum + driver.totalRevenue, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
