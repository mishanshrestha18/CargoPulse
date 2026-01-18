-- Add delivery_location_id column to shipment_items table
-- This allows each item in a multi-item shipment to have its own delivery location

-- Add the column (allowing NULL for existing records)
ALTER TABLE shipment_items
ADD COLUMN IF NOT EXISTS delivery_location_id BIGINT;

-- Add foreign key constraint to locations table
ALTER TABLE shipment_items
ADD CONSTRAINT shipment_items_delivery_location_fkey
FOREIGN KEY (delivery_location_id)
REFERENCES locations(id)
ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_shipment_items_delivery_location
ON shipment_items(delivery_location_id);

-- Update existing shipment_items to use their shipment's destination as delivery location
-- (This backfills data for existing records)
UPDATE shipment_items si
SET delivery_location_id = s.destination_location_id
FROM shipments s
WHERE si.shipment_id = s.id
AND si.delivery_location_id IS NULL;

-- Verify the changes
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'shipment_items'
ORDER BY ordinal_position;

-- Show sample data
SELECT
  si.id,
  si.shipment_id,
  si.item_name,
  si.quantity,
  si.delivery_location_id,
  l.name as delivery_location_name
FROM shipment_items si
LEFT JOIN locations l ON l.id = si.delivery_location_id
LIMIT 5;
