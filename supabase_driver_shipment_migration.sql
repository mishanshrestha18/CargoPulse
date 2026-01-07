-- Create drivers table for Driver Dispatch system
-- Using BIGSERIAL to match the ID type of vehicles, locations, and inventory tables
DROP TABLE IF EXISTS drivers CASCADE;

CREATE TABLE drivers (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Idle' CHECK (status IN ('Idle', 'Busy')),
  phone TEXT,
  license_number TEXT
);

-- Create shipments table for tracking dispatched shipments
-- All foreign keys use BIGINT to match the referenced tables
DROP TABLE IF EXISTS shipments CASCADE;

CREATE TABLE shipments (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  driver_id BIGINT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  origin BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  destination BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  inventory_item_id BIGINT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'In Transit' CHECK (status IN ('In Transit', 'Delivered', 'Cancelled')),
  urgency TEXT NOT NULL DEFAULT 'standard' CHECK (urgency IN ('standard', 'express')),
  total_cost DECIMAL(10, 2) NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_arrival_time ON shipments(arrival_time);
CREATE INDEX IF NOT EXISTS idx_shipments_status_arrival ON shipments(status, arrival_time);

-- Insert some sample drivers for testing (optional)
INSERT INTO drivers (name, status, phone, license_number) VALUES
  ('John Smith', 'Idle', '+1-555-0101', 'DL12345'),
  ('Maria Garcia', 'Idle', '+1-555-0102', 'DL23456'),
  ('David Chen', 'Idle', '+1-555-0103', 'DL34567'),
  ('Sarah Johnson', 'Idle', '+1-555-0104', 'DL45678')
ON CONFLICT DO NOTHING;
