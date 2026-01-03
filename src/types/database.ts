export interface Location {
  id: string;
  created_at: string;
  name: string;
  type: 'warehouse' | 'port';
  latitude: number;
  longitude: number;
}

export type LocationInsert = Omit<Location, 'id' | 'created_at'>;

export interface Vehicle {
  id: string;
  created_at: string;
  name: string;
  type: string;
  status: 'In Transit' | 'Idle' | 'Maintenance';
  capacity: number;
}

export type VehicleInsert = Omit<Vehicle, 'id' | 'created_at'>;

export interface Inventory {
  id: string;
  created_at: string;
  sku: string;
  item_name: string;
  quantity: number;
  location: string;
  status: string;
}

export type InventoryInsert = Omit<Inventory, 'id' | 'created_at'>;
