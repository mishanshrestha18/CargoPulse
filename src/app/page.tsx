'use client';

import dynamic from 'next/dynamic';
import AddLocationForm from './components/AddLocationForm';
import DashboardStats from '@/components/DashboardStats';

// Dynamically import Map component with no SSR
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Logistics Dashboard</h1>

      {/* Dashboard Statistics */}
      <DashboardStats />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Left Column: Input Form */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Add New Node</h2>
          <AddLocationForm />
        </div>

        {/* Right Column: Live Route Map */}
        <div>
          <Map />
        </div>

      </div>
    </div>
  );
}
