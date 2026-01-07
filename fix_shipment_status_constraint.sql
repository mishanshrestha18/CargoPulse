-- Fix shipment status constraint to allow 'Cancelled' status
-- This resolves the error: "new row for relation "shipments" violates check constraint "shipments_status_check""

-- Drop the existing constraint
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;

-- Add the updated constraint that includes 'Cancelled'
ALTER TABLE shipments ADD CONSTRAINT shipments_status_check
  CHECK (status IN ('In Transit', 'Delivered', 'Cancelled'));

-- Verify the constraint was updated
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'shipments_status_check';
