import AirplanesTable from '@/components/AirplanesTable';

export default function AirplanesPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Airplane Fleet Management</h1>
      <AirplanesTable />
    </div>
  );
}
