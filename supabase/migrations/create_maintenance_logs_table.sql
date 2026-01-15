-- Create maintenance_logs table for tracking vehicle maintenance
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  cost NUMERIC(10, 2) DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('In Progress', 'Completed')),
  completed_at TIMESTAMPTZ,
  CONSTRAINT positive_cost CHECK (cost >= 0)
);

-- Create index on vehicle_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_vehicle_id ON maintenance_logs(vehicle_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_status ON maintenance_logs(status);

-- Add comment to table
COMMENT ON TABLE maintenance_logs IS 'Tracks maintenance history for vehicles';

-- Add comments to columns
COMMENT ON COLUMN maintenance_logs.vehicle_id IS 'Reference to the vehicle being maintained';
COMMENT ON COLUMN maintenance_logs.description IS 'Description of the maintenance work (e.g., Oil change, tire replacement)';
COMMENT ON COLUMN maintenance_logs.cost IS 'Estimated or actual cost of maintenance in dollars';
COMMENT ON COLUMN maintenance_logs.status IS 'Current status: In Progress or Completed';
COMMENT ON COLUMN maintenance_logs.completed_at IS 'Timestamp when maintenance was completed';
