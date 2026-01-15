-- Update shipments table for multi-item support
-- Make old single-item columns nullable since we now use shipment_items table

ALTER TABLE shipments 
  ALTER COLUMN inventory_item_id DROP NOT NULL,
  ALTER COLUMN quantity DROP NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN shipments.inventory_item_id IS 'Legacy column - use shipment_items table for multi-item shipments';
COMMENT ON COLUMN shipments.quantity IS 'Legacy column - use shipment_items table for multi-item shipments';
