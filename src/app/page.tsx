'use client';

import dynamic from 'next/dynamic';
import AddLocationForm from './components/AddLocationForm';
import DashboardStats from '@/components/DashboardStats';
import DashboardCharts from '@/components/DashboardCharts';
import ShipmentCreator from '@/components/ShipmentCreator';
import ActiveShipmentsList from '@/components/ActiveShipmentsList';

// Dynamically import Map components with no SSR
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
});

const MapWithLiveTracking = dynamic(() => import('@/components/MapWithLiveTracking'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">Logistics Dashboard</h1>

      {/* Dashboard Statistics */}
      <DashboardStats />

      {/* Dashboard Charts */}
      <DashboardCharts />

      {/* Shipment Creator - Smart Order Dispatch */}
      <div className="mb-8">
        <ShipmentCreator />
      </div>

      {/* Live Tracking Section - Active Shipments + Moving Trucks Map */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Fleet Simulation & Live Tracking</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Active Shipments List (1/3 width) */}
          <div className="lg:col-span-1">
            <ActiveShipmentsList />
          </div>

          {/* Right: Live Tracking Map (2/3 width) */}
          <div className="lg:col-span-2">
            <MapWithLiveTracking />
          </div>
        </div>
      </div>

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
    </div>
  );
}
