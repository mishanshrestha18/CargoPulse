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
  efficiency: number;
}

const FLEET_COLORS = {
  'In Transit': '#10b981', // Green
  'Idle': '#fbbf24', // Yellow
  'Maintenance': '#ef4444', // Red
};

// Mock data for Revenue Trends (last 6 months)
const MOCK_REVENUE_DATA: RevenueData[] = [
  { month: 'Jan', revenue: 12000 },
  { month: 'Feb', revenue: 15000 },
  { month: 'Mar', revenue: 13500 },
  { month: 'Apr', revenue: 18000 },
  { month: 'May', revenue: 22000 },
  { month: 'Jun', revenue: 25000 },
];

// Mock data for Top Driver Performance
const MOCK_DRIVER_PERFORMANCE: DriverPerformanceData[] = [
  { name: 'John Smith', efficiency: 95 },
  { name: 'Sarah Johnson', efficiency: 92 },
  { name: 'Mike Chen', efficiency: 88 },
  { name: 'Emily Davis', efficiency: 85 },
  { name: 'Robert Brown', efficiency: 78 },
];

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
  const [inventoryData, setInventoryData] = useState<InventoryData[]>([]);
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

      // Process Fleet Status Data
      const statusCounts: { [key: string]: number } = {
        'In Transit': 0,
        'Idle': 0,
        'Maintenance': 0,
      };

      vehicles?.forEach((vehicle: Vehicle) => {
        statusCounts[vehicle.status] = (statusCounts[vehicle.status] || 0) + 1;
      });

      const processedFleetData = Object.entries(statusCounts).map(([name, value]) => ({
        name,
        value,
      }));

      setFleetData(processedFleetData);

      // Process Inventory Data - Top 5 by quantity
      const sortedInventory = (inventory || [])
        .sort((a: Inventory, b: Inventory) => b.quantity - a.quantity)
        .slice(0, 5)
        .map((item: Inventory) => ({
          name: item.item_name,
          quantity: item.quantity,
        }));

      setInventoryData(sortedInventory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chart data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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

      {/* First Row - Fleet Status & Inventory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Fleet Status Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Fleet Status Distribution</h3>
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

        {/* Top 5 Inventory Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Top 5 Inventory Items by Quantity</h3>
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
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Revenue Trends</h3>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart
              data={MOCK_REVENUE_DATA}
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
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
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
                ${MOCK_REVENUE_DATA.reduce((sum, item) => sum + item.revenue, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Top Driver Performance Horizontal Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Top Driver Performance</h3>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={MOCK_DRIVER_PERFORMANCE}
              layout="horizontal"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                type="number"
                domain={[0, 100]}
                stroke="#6b7280"
                style={{ fontSize: '14px' }}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#6b7280"
                style={{ fontSize: '14px' }}
                width={90}
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, 'Efficiency']}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <ReferenceLine
                x={90}
                stroke="#fbbf24"
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{
                  value: 'Target: 90%',
                  position: 'top',
                  fill: '#f59e0b',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              />
              <Bar
                dataKey="efficiency"
                fill="#3b82f6"
                name="Efficiency Score"
                radius={[0, 8, 8, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">Average Efficiency</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {(MOCK_DRIVER_PERFORMANCE.reduce((sum, driver) => sum + driver.efficiency, 0) / MOCK_DRIVER_PERFORMANCE.length).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
