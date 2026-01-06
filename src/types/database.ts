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
  price_per_unit: number;
  max_discount: number;
  // Tiered discount structure: [qty_threshold, discount_percent]
  discount_tier_1_qty?: number;  // e.g., 10 items
  discount_tier_1_percent?: number;  // e.g., 5%
  discount_tier_2_qty?: number;  // e.g., 50 items
  discount_tier_2_percent?: number;  // e.g., 10%
  discount_tier_3_qty?: number;  // e.g., 100 items
  discount_tier_3_percent?: number;  // e.g., 15%
}

export type InventoryInsert = Omit<Inventory, 'id' | 'created_at'>;

export interface Driver {
  id: string;
  created_at: string;
  name: string;
  status: 'Idle' | 'Busy';
  phone?: string;
  license_number?: string;
}

export type DriverInsert = Omit<Driver, 'id' | 'created_at'>;

export interface Shipment {
  id: string;
  created_at: string;
  driver_id: string;
  vehicle_id: string;
  origin: string;
  destination: string;
  inventory_item_id: string;
  quantity: number;
  arrival_time: string;
  status: 'In Transit' | 'Delivered';
  urgency: 'standard' | 'express';
  total_cost: number;
}

export type ShipmentInsert = Omit<Shipment, 'id' | 'created_at'>;
