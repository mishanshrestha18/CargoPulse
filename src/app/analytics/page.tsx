'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DollarSign,
  TrendingUp,
  Wrench,
  Truck,
  RefreshCw,
  TrendingDown,
  Activity
} from 'lucide-react';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface KPIMetrics {
  totalRevenue: number;
  totalMaintenanceCosts: number;
  estimatedFuelCost: number;
  netProfit: number;
  activeFleetPercentage: number;
  totalVehicles: number;
  activeVehicles: number;
}

interface RevenueVsCostData {
  period: string;
  revenue: number;
  maintenanceCost: number;
  fuelCost: number;
}

interface FleetStatusData {
  name: string;
  value: number;
  percentage: number;
}

interface DriverPerformance {
  name: string;
  trips: number;
  revenue: number;
}

const COLORS = {
  idle: '#10b981', // green
  inTransit: '#3b82f6', // blue
  maintenance: '#f59e0b', // orange
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpiMetrics, setKpiMetrics] = useState<KPIMetrics>({
    totalRevenue: 0,
    totalMaintenanceCosts: 0,
    estimatedFuelCost: 0,
    netProfit: 0,
    activeFleetPercentage: 0,
    totalVehicles: 0,
    activeVehicles: 0,
  });

  const [revenueVsCostData, setRevenueVsCostData] = useState<RevenueVsCostData[]>([]);
  const [fleetStatusData, setFleetStatusData] = useState<FleetStatusData[]>([]);
  const [driverPerformanceData, setDriverPerformanceData] = useState<DriverPerformance[]>([]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all required data in parallel
      const [shipmentsRes, vehiclesRes, maintenanceRes, driversRes] = await Promise.all([
        supabase.from('shipments').select('*'),
        supabase.from('vehicles').select('*'),
        supabase.from('maintenance_logs').select('*'),
        supabase.from('drivers').select('id, name'),
      ]);

      if (shipmentsRes.error) throw shipmentsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (maintenanceRes.error) throw maintenanceRes.error;
      if (driversRes.error) throw driversRes.error;

      const shipments = shipmentsRes.data || [];
      const vehicles = vehiclesRes.data || [];
      const maintenanceLogs = maintenanceRes.data || [];
      const drivers = driversRes.data || [];

      // Calculate KPI Metrics
      const totalRevenue = shipments.reduce((sum, s) => sum + (s.total_cost || 0), 0);
      const totalMaintenanceCosts = maintenanceLogs.reduce((sum, m) => sum + (m.cost || 0), 0);
      const estimatedFuelCost = totalRevenue * 0.20; // 20% of revenue
      const netProfit = totalRevenue - totalMaintenanceCosts - estimatedFuelCost;

      const totalVehicles = vehicles.length;
      const activeVehicles = vehicles.filter(v => v.status === 'In Transit').length;
      const activeFleetPercentage = totalVehicles > 0 ? (activeVehicles / totalVehicles) * 100 : 0;

      setKpiMetrics({
        totalRevenue,
        totalMaintenanceCosts,
        estimatedFuelCost,
        netProfit,
        activeFleetPercentage,
        totalVehicles,
        activeVehicles,
      });

      // Calculate Revenue vs Cost Over Time (by Month)
      const revenueByMonth = new Map<string, { revenue: number; maintenanceCost: number }>();

      shipments.forEach(shipment => {
        if (shipment.created_at) {
          const date = new Date(shipment.created_at);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          const existing = revenueByMonth.get(monthKey) || { revenue: 0, maintenanceCost: 0 };
          existing.revenue += shipment.total_cost || 0;
          revenueByMonth.set(monthKey, existing);
        }
      });

      maintenanceLogs.forEach(log => {
        if (log.maintenance_date) {
          const date = new Date(log.maintenance_date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          const existing = revenueByMonth.get(monthKey) || { revenue: 0, maintenanceCost: 0 };
          existing.maintenanceCost += log.cost || 0;
          revenueByMonth.set(monthKey, existing);
        }
      });

      const sortedMonths = Array.from(revenueByMonth.keys()).sort();
      const revenueVsCost = sortedMonths.map(monthKey => {
        const data = revenueByMonth.get(monthKey)!;
        return {
          period: monthKey,
          revenue: data.revenue,
          maintenanceCost: data.maintenanceCost,
          fuelCost: data.revenue * 0.20,
        };
      });

      setRevenueVsCostData(revenueVsCost);

      // Calculate Fleet Status Distribution
      const statusCounts = {
        Idle: 0,
        'In Transit': 0,
        Maintenance: 0,
      };

      vehicles.forEach(vehicle => {
        const status = vehicle.status as keyof typeof statusCounts;
        if (status in statusCounts) {
          statusCounts[status]++;
        }
      });

      const fleetStatus: FleetStatusData[] = Object.entries(statusCounts).map(([name, value]) => ({
        name,
        value,
        percentage: totalVehicles > 0 ? (value / totalVehicles) * 100 : 0,
      }));

      setFleetStatusData(fleetStatus);

      // Calculate Top 5 Performing Drivers (by completed trips)
      const driverTrips = new Map<string, { name: string; trips: number; revenue: number }>();

      shipments
        .filter(s => s.status === 'Delivered')
        .forEach(shipment => {
          const driverId = String(shipment.driver_id);
          const driver = drivers.find(d => String(d.id) === driverId);

          if (driver) {
            const existing = driverTrips.get(driverId) || { name: driver.name, trips: 0, revenue: 0 };
            existing.trips++;
            existing.revenue += shipment.total_cost || 0;
            driverTrips.set(driverId, existing);
          }
        });

      const topDrivers = Array.from(driverTrips.values())
        .sort((a, b) => b.trips - a.trips)
        .slice(0, 5);

      setDriverPerformanceData(topDrivers);

    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchAnalyticsData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            Business Intelligence Dashboard
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive analytics and key performance indicators
          </p>
        </div>
        <button
          onClick={fetchAnalyticsData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Revenue */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Total Revenue
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                ${kpiMetrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                From all shipments
              </p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
              <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Net Profit
              </p>
              <p className={`text-3xl font-bold ${
                kpiMetrics.netProfit >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                ${kpiMetrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Revenue - Costs
              </p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
              {kpiMetrics.netProfit >= 0 ? (
                <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              ) : (
                <TrendingDown className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              )}
            </div>
          </div>
        </div>

        {/* Total Maintenance Costs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Maintenance Costs
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                ${kpiMetrics.totalMaintenanceCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                + ${kpiMetrics.estimatedFuelCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} fuel (est.)
              </p>
            </div>
            <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-full">
              <Wrench className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>

        {/* Active Fleet % */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Active Fleet
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {kpiMetrics.activeFleetPercentage.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {kpiMetrics.activeVehicles} of {kpiMetrics.totalVehicles} vehicles
              </p>
            </div>
            <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full">
              <Truck className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart A: Revenue vs Cost Over Time */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Revenue vs. Cost Over Time
            </h2>
          </div>
          {revenueVsCostData.length === 0 ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">No data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={revenueVsCostData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMaintenance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="period"
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#f9fafb',
                  }}
                  formatter={(value: any) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  name="Revenue"
                />
                <Area
                  type="monotone"
                  dataKey="maintenanceCost"
                  stroke="#f59e0b"
                  fillOpacity={1}
                  fill="url(#colorMaintenance)"
                  name="Maintenance Cost"
                />
                <Area
                  type="monotone"
                  dataKey="fuelCost"
                  stroke="#ef4444"
                  fillOpacity={1}
                  fill="url(#colorFuel)"
                  name="Fuel Cost (Est.)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart B: Fleet Status Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-6">
            <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Fleet Status Distribution
            </h2>
          </div>
          {fleetStatusData.every(d => d.value === 0) ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">No fleet data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={fleetStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {fleetStatusData.map((entry, index) => {
                    const colorKey = entry.name.toLowerCase().replace(' ', '') as keyof typeof COLORS;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[colorKey] || COLORS.idle}
                      />
                    );
                  })}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#f9fafb',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart C: Top 5 Performing Drivers */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Top 5 Performing Drivers
            </h2>
          </div>
          {driverPerformanceData.length === 0 ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">No driver data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={driverPerformanceData}
                layout="horizontal"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  type="number"
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    color: '#f9fafb',
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'revenue') {
                      return [`$${value.toLocaleString()}`, 'Revenue'];
                    }
                    return [value, 'Completed Trips'];
                  }}
                />
                <Legend />
                <Bar dataKey="trips" fill="#3b82f6" name="Completed Trips" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Cost Breakdown Summary */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
          Cost Breakdown Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Maintenance Costs</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              ${kpiMetrics.totalMaintenanceCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {((kpiMetrics.totalMaintenanceCosts / kpiMetrics.totalRevenue) * 100 || 0).toFixed(1)}% of revenue
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Estimated Fuel Costs</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              ${kpiMetrics.estimatedFuelCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              20% of revenue (estimated)
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Operating Costs</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${(kpiMetrics.totalMaintenanceCosts + kpiMetrics.estimatedFuelCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {(((kpiMetrics.totalMaintenanceCosts + kpiMetrics.estimatedFuelCost) / kpiMetrics.totalRevenue) * 100 || 0).toFixed(1)}% of revenue
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
