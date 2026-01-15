-- Migration for UUID ID columns (if schema uses uuid)
-- Run this if the schema check shows data_type = 'uuid' or udt_name = 'uuid'

CREATE TABLE IF NOT EXISTS shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory(id),
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_per_unit DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_inventory_id ON shipment_items(inventory_item_id);

ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for shipment_items" ON shipment_items
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE shipment_items IS 'Stores individual items for each shipment (manifest)';
