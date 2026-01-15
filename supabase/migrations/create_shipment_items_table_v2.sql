-- Create shipment_items table for multi-item shipments
-- Using explicit type casting to match existing table schemas

-- First, check what type shipments.id actually is by creating with matching type
CREATE TABLE IF NOT EXISTS shipment_items (
  id BIGSERIAL PRIMARY KEY,
  shipment_id BIGINT NOT NULL,
  inventory_item_id BIGINT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_per_unit DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign keys separately to see which one fails
-- This will help identify if shipments or inventory has different types
ALTER TABLE shipment_items
  ADD CONSTRAINT fk_shipment_items_shipment
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE;

ALTER TABLE shipment_items
  ADD CONSTRAINT fk_shipment_items_inventory
  FOREIGN KEY (inventory_item_id) REFERENCES inventory(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_inventory_id ON shipment_items(inventory_item_id);

-- Enable Row Level Security
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Enable all operations for shipment_items" ON shipment_items
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE shipment_items IS 'Stores individual items for each shipment (manifest)';
