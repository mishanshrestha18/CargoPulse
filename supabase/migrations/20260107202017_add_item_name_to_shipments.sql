-- Add item_name column to shipments table for inventory transfer tracking
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS item_name TEXT;

-- Update existing shipments with item names from inventory table
UPDATE shipments s
SET item_name = i.item_name
FROM inventory i
WHERE s.inventory_item_id = i.id
AND s.item_name IS NULL;

-- Make item_name NOT NULL after backfilling
ALTER TABLE shipments ALTER COLUMN item_name SET NOT NULL;
