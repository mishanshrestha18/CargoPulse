import InventoryTable from '@/components/InventoryTable';

export default function WarehousePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Warehouse Inventory</h1>
      <InventoryTable />
    </div>
  );
}
