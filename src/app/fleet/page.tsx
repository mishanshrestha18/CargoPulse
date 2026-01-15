import FleetTable from '@/components/FleetTable';

export default function FleetPage() {
  return (
    <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">Fleet Management</h1>
      <FleetTable />
    </div>
  );
}
