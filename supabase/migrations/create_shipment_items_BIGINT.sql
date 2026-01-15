-- Migration for BIGINT ID columns (if schema uses bigint/bigserial)
-- Run this if the schema check shows data_type = 'bigint'

CREATE TABLE IF NOT EXISTS shipment_items (
  id BIGSERIAL PRIMARY KEY,
  shipment_id BIGINT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  inventory_item_id BIGINT NOT NULL REFERENCES inventory(id),
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
