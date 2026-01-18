'use client';

import MaintenanceTable from '@/components/MaintenanceTable';

export default function MaintenancePage() {
  return (
    <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">Fleet Maintenance</h1>
      <MaintenanceTable />
    </div>
  );
}
