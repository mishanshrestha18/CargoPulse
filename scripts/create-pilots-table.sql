-- Create pilots table for aircraft personnel
-- Run this in your Supabase SQL Editor

-- Step 1: Create the pilots table
CREATE TABLE IF NOT EXISTS pilots (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Idle' CHECK (status IN ('Idle', 'Busy')),
  phone TEXT,
  license_number TEXT,
  certifications TEXT -- e.g., "ATP, CFI, Multi-Engine"
);

-- Step 2: Add pilot_id column to shipments table (for plane/hybrid routes)
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS pilot_id BIGINT REFERENCES pilots(id);

-- Step 3: Enable Row Level Security (RLS) on pilots table
ALTER TABLE pilots ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for pilots table (similar to drivers)
-- Allow all authenticated users to read pilots
CREATE POLICY "Allow authenticated users to read pilots"
ON pilots FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert pilots
CREATE POLICY "Allow authenticated users to insert pilots"
ON pilots FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update pilots
CREATE POLICY "Allow authenticated users to update pilots"
ON pilots FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to delete pilots
CREATE POLICY "Allow authenticated users to delete pilots"
ON pilots FOR DELETE
TO authenticated
USING (true);

-- Step 5: Insert sample pilots (optional - uncomment if needed)
INSERT INTO pilots (name, status, phone, license_number, certifications) VALUES
  ('Captain Anderson', 'Idle', '+1-555-0201', 'ATP-12345', 'ATP, Multi-Engine, Type Rating B737'),
  ('Captain Martinez', 'Idle', '+1-555-0202', 'ATP-23456', 'ATP, CFI, Multi-Engine'),
  ('Captain Thompson', 'Idle', '+1-555-0203', 'ATP-34567', 'ATP, Multi-Engine, Type Rating A320'),
  ('First Officer Wilson', 'Idle', '+1-555-0204', 'CPL-45678', 'CPL, Multi-Engine, Instrument'),
  ('Captain Chen', 'Idle', '+1-555-0205', 'ATP-56789', 'ATP, CFI, CFII, Multi-Engine');

-- Step 6: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_pilots_status ON pilots(status);

-- Step 7: Remove the role column from drivers table if it exists (cleanup)
ALTER TABLE drivers DROP COLUMN IF EXISTS role;

-- Verify the pilots table
SELECT * FROM pilots ORDER BY name;

-- Verify the shipments table has pilot_id column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'shipments' AND column_name = 'pilot_id';
