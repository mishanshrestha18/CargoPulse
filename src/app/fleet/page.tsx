import FleetTable from '@/components/FleetTable';

export default function FleetPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Fleet Management</h1>
      <FleetTable />
    </div>
  );
}
