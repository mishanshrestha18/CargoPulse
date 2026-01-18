-- Create shipment_stops table for intermediate waypoints
-- Run this in Supabase SQL Editor
-- Note: Using BIGINT to match existing shipments table structure

CREATE TABLE IF NOT EXISTS shipment_stops (
  id BIGSERIAL PRIMARY KEY,
  shipment_id BIGINT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  arrival_time TIMESTAMP WITH TIME ZONE,
  departure_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_shipment_stops_shipment_id ON shipment_stops(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_stops_order ON shipment_stops(shipment_id, stop_order);

-- Enable RLS
ALTER TABLE shipment_stops ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all shipment stops
CREATE POLICY "Allow authenticated users to read shipment stops"
  ON shipment_stops FOR SELECT TO authenticated
  USING (true);

-- Allow authenticated users to insert shipment stops
CREATE POLICY "Allow authenticated users to insert shipment stops"
  ON shipment_stops FOR INSERT TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update shipment stops
CREATE POLICY "Allow authenticated users to update shipment stops"
  ON shipment_stops FOR UPDATE TO authenticated
  USING (true);

-- Allow authenticated users to delete shipment stops
CREATE POLICY "Allow authenticated users to delete shipment stops"
  ON shipment_stops FOR DELETE TO authenticated
  USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON shipment_stops TO authenticated;

-- Verify table was created
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'shipment_stops'
ORDER BY ordinal_position;
