import AirplanesTable from '@/components/AirplanesTable';

export default function AirplanesPage() {
  return (
    <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">Airplane Fleet Management</h1>
      <AirplanesTable />
    </div>
  );
}
