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

export interface Pilot {
  id: string;
  created_at: string;
  name: string;
  status: 'Idle' | 'Busy';
  phone?: string;
  license_number?: string;
  certifications?: string; // e.g., "ATP, CFI, Multi-Engine"
}

export type PilotInsert = Omit<Pilot, 'id' | 'created_at'>;

export interface Shipment {
  id: string;
  created_at: string;
  driver_id: string;
  pilot_id?: string; // For plane or hybrid routes
  vehicle_id: string;
  origin: string;
  destination: string;
  inventory_item_id?: string; // Optional for backward compatibility
  item_name?: string; // Optional for backward compatibility
  quantity?: number; // Optional for backward compatibility
  arrival_time: string;
  status: 'In Transit' | 'Delivered' | 'Cancelled';
  urgency: 'standard' | 'express';
  total_cost: number;
  shipping_method?: 'truck' | 'plane';
}

export type ShipmentInsert = Omit<Shipment, 'id' | 'created_at'>;

export interface ShipmentItem {
  id: number;
  created_at: string;
  shipment_id: number;
  inventory_item_id: number;
  item_name: string;
  delivery_location_id?: number; // NEW: Individual delivery location for each item
  quantity: number;
  price_per_unit: number;
  total_cost: number;
}

export type ShipmentItemInsert = Omit<ShipmentItem, 'id' | 'created_at'>;

export interface ShipmentStop {
  id: number;
  created_at: string;
  shipment_id: number;
  location_id: number;
  stop_order: number;
  arrival_time?: string;
  departure_time?: string;
  notes?: string;
  // Joined from locations table
  location?: Location;
}

export type ShipmentStopInsert = Omit<ShipmentStop, 'id' | 'created_at' | 'location'>;

export interface MaintenanceLog {
  id: string;
  created_at: string;
  vehicle_id: string;
  description: string;
  cost: number;
  status: 'In Progress' | 'Completed';
  completed_at?: string;
}

export type MaintenanceLogInsert = Omit<MaintenanceLog, 'id' | 'created_at'>;

// Supabase Real-time Notifications
export type NotificationType = 'dispatch' | 'arrival' | 'cancel' | 'alert' | 'maintenance' | 'info';

export interface DBNotification {
  id: string;
  created_at: string;
  user_id?: string; // Optional: for user-specific notifications
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  metadata?: Record<string, any>; // Extra data like shipment_id, vehicle_id, etc.
}

export type DBNotificationInsert = Omit<DBNotification, 'id' | 'created_at'>;

// Expense Management
export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export interface Expense {
  id: string;
  created_at: string;
  user_id: string;
  driver_name: string;
  amount: number;
  description: string;
  receipt_url?: string;
  status: ExpenseStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

export type ExpenseInsert = Omit<Expense, 'id' | 'created_at'>;
