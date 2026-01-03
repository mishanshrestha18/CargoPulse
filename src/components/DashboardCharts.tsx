'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RefreshCw } from 'lucide-react';
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

const FLEET_COLORS = {
  'In Transit': '#10b981', // Green
  'Idle': '#fbbf24', // Yellow
  'Maintenance': '#ef4444', // Red
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
      <div className="mb-6 p-4 bg-red-50 text-red-800 border border-red-200 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fleet Status Pie Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Fleet Status Distribution</h3>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : fleetData.every(d => d.value === 0) ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-gray-500">No fleet data available</p>
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
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 5 Inventory Items by Quantity</h3>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : inventoryData.length === 0 ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-gray-500">No inventory data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={inventoryData}
                margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tickFormatter={(value) => value.length > 10 ? `${value.slice(0, 10)}...` : value}
                />
                <YAxis />
                <Tooltip
                  formatter={(value, name, props) => [value, 'Quantity']}
                  labelFormatter={(label) => inventoryData.find(d => d.name.startsWith(label.slice(0, 10)))?.name || label}
                />
                <Legend />
                <Bar dataKey="quantity" fill="#3b82f6" name="Quantity" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
