'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import AddLocationForm from './components/AddLocationForm';
import DashboardStats from '@/components/DashboardStats';
import DashboardCharts from '@/components/DashboardCharts';
import ShipmentCreator from '@/components/ShipmentCreator';
import ActiveShipmentsList from '@/components/ActiveShipmentsList';
import { useAuth } from '@/contexts/AuthContext';

// Dynamically import Map components with no SSR
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
});

const MapWithLiveTracking = dynamic(() => import('@/components/MapWithLiveTracking'), {
  ssr: false,
});

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { userRole, loading } = useAuth();
  const router = useRouter();

  // Drivers do not get the dashboard. Everything here is fleet-wide, and a driver
  // should only ever see the jobs assigned to them.
  useEffect(() => {
    if (!loading && userRole === 'driver') {
      router.replace('/my-tasks');
    }
  }, [loading, userRole, router]);

  const handleRefreshAll = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Determine what sections to show based on role
  const isAdmin = userRole === 'admin';
  const isDispatcher = userRole === 'dispatcher';
  const isDriver = userRole === 'driver';
  const canViewAnalytics = isAdmin || isDispatcher;
  const canDispatch = isAdmin || isDispatcher;

  if (loading || userRole === 'driver') {
    return null;
  }

  return (
    <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-6 pr-12">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          {isDriver ? 'Driver Dashboard' : 'Logistics Dashboard'}
        </h1>
        <button
          onClick={handleRefreshAll}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shadow-md"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Dashboard
        </button>
      </div>

      {/* Dashboard Statistics - visible to all roles */}
      <DashboardStats refreshTrigger={refreshTrigger} />

      {/* Dashboard Charts - only for admin/dispatcher */}
      {canViewAnalytics && (
        <DashboardCharts refreshTrigger={refreshTrigger} />
      )}

      {/* Shipment Creator - Smart Order Dispatch - only for admin/dispatcher */}
      {canDispatch && (
        <div className="mb-8">
          <ShipmentCreator refreshTrigger={refreshTrigger} onDispatchSuccess={handleRefreshAll} />
        </div>
      )}

      {/* Live Tracking Section - Active Shipments + Moving Trucks Map */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
          {isDriver ? 'My Active Shipments' : 'Fleet Simulation & Live Tracking'}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Active Shipments List (1/3 width) */}
          <div className="lg:col-span-1">
            <ActiveShipmentsList refreshTrigger={refreshTrigger} onShipmentChange={handleRefreshAll} />
          </div>

          {/* Right: Live Tracking Map (2/3 width) */}
          <div className="lg:col-span-2">
            <MapWithLiveTracking />
          </div>
        </div>
      </div>

      {/* Admin/Dispatcher only sections */}
      {canDispatch && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Input Form */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Add New Node</h2>
            <AddLocationForm />
          </div>

          {/* Right Column: Route Planner Map */}
          <div>
            <Map />
          </div>
        </div>
      )}
    </div>
  );
}
