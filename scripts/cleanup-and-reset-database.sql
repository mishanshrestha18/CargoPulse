-- Emergency Database Cleanup and Reset Script
-- Run this in Supabase SQL Editor to fix all issues
-- This will clean up orphaned data and reset states

-- 1. First, let's see what we have
SELECT 'Active Shipments' as category, COUNT(*) as count FROM shipments WHERE status = 'In Transit'
UNION ALL
SELECT 'Vehicles In Transit', COUNT(*) FROM vehicles WHERE status = 'In Transit'
UNION ALL
SELECT 'Drivers In Transit', COUNT(*) FROM drivers WHERE status = 'In Transit'
UNION ALL
SELECT 'Total Shipments', COUNT(*) FROM shipments
UNION ALL
SELECT 'Total Vehicles', COUNT(*) FROM vehicles
UNION ALL
SELECT 'Total Drivers', COUNT(*) FROM drivers;

-- 2. Cancel all active shipments and reset vehicles/drivers
-- This will set everything back to idle state

-- Update all vehicles to Idle
UPDATE vehicles
SET status = 'Idle'
WHERE status = 'In Transit';

-- Update all drivers to Idle
UPDATE drivers
SET status = 'Idle'
WHERE status = 'In Transit';

-- Cancel all active shipments (set to Cancelled instead of deleting)
UPDATE shipments
SET status = 'Cancelled'
WHERE status IN ('In Transit', 'Pending');

-- 3. Clean up any orphaned shipment_items
DELETE FROM shipment_items
WHERE shipment_id NOT IN (SELECT id FROM shipments);

-- 4. Clean up any orphaned shipment_stops
DELETE FROM shipment_stops
WHERE shipment_id NOT IN (SELECT id FROM shipments);

-- 5. Verify the cleanup
SELECT 'After Cleanup - Active Shipments' as category, COUNT(*) as count FROM shipments WHERE status = 'In Transit'
UNION ALL
SELECT 'After Cleanup - Vehicles In Transit', COUNT(*) FROM vehicles WHERE status = 'In Transit'
UNION ALL
SELECT 'After Cleanup - Drivers In Transit', COUNT(*) FROM drivers WHERE status = 'In Transit'
UNION ALL
SELECT 'After Cleanup - Idle Vehicles', COUNT(*) FROM vehicles WHERE status = 'Idle'
UNION ALL
SELECT 'After Cleanup - Idle Drivers', COUNT(*) FROM drivers WHERE status = 'Idle';

-- 6. Optional: Delete all cancelled shipments if you want a completely clean slate
-- Uncomment the line below if you want to remove all cancelled shipments
-- DELETE FROM shipments WHERE status = 'Cancelled';

-- Success message
SELECT '✅ Database cleanup completed successfully!' as message;
