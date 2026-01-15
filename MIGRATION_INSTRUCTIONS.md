# Multi-Item Shipments Migration Instructions

## Problem

We need to create the `shipment_items` table, but we're getting a foreign key type mismatch error. The error says UUID vs BIGINT mismatch, but the actual data in the tables shows numeric IDs (1, 2, 3, etc.).

## Diagnosis Results

Running `node scripts/diagnose-schema.js` shows:
- All IDs in shipments, inventory, drivers, and vehicles tables are **numbers**
- But the error message suggests **UUID** type mismatch

This means the PostgreSQL schema definition likely uses UUID types, but JavaScript is coercing them to numbers when retrieving data.

## Steps to Fix

### Step 1: Check Actual PostgreSQL Schema

Run this SQL in Supabase Dashboard:
https://supabase.com/dashboard/project/gwkugefxjpocjwaymvjw/sql/new

```sql
SELECT
  table_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name IN ('shipments', 'inventory', 'drivers', 'vehicles')
  AND column_name = 'id'
ORDER BY table_name;
```

### Step 2: Choose the Correct Migration

Based on the query results:

**If you see `data_type = 'uuid'` or `udt_name = 'uuid'`:**
- Run: `supabase/migrations/create_shipment_items_UUID.sql`
- Update TypeScript types: ShipmentItem IDs should be `string`

**If you see `data_type = 'bigint'` or `udt_name = 'int8'`:**
- Run: `supabase/migrations/create_shipment_items_BIGINT.sql`
- TypeScript types are already correct: ShipmentItem IDs are `number`

### Step 3: Run the Migration

Copy the contents of the chosen file and paste into Supabase SQL Editor:
https://supabase.com/dashboard/project/gwkugefxjpocjwaymvjw/sql/new

Click "Run" to execute the migration.

### Step 4: Verify Migration

After running the SQL, verify it worked:

```bash
node scripts/auto-migrate-shipment-items.js
```

You should see:
```
✅ shipment_items table exists!
✅ Components are using multi-item system
✅ MIGRATION COMPLETE!
```

### Step 5: Update TypeScript Types (if UUID)

If you used the UUID migration, update `src/types/database.ts`:

```typescript
export interface ShipmentItem {
  id: string;  // Changed from number to string
  created_at: string;
  shipment_id: string;  // Changed from number to string
  inventory_item_id: string;  // Changed from number to string
  item_name: string;
  quantity: number;
  price_per_unit: number;
  total_cost: number;
}
```

## Files Created

- `supabase/migrations/create_shipment_items_BIGINT.sql` - For BIGINT schemas
- `supabase/migrations/create_shipment_items_UUID.sql` - For UUID schemas
- `scripts/diagnose-schema.js` - Schema diagnosis tool
- `scripts/check-table-schema.sql` - Direct PostgreSQL schema query

## Component Changes Already Made

- ✅ `src/components/ShipmentCreator.tsx` - Multi-item manifest builder
- ✅ `src/components/ShipmentMonitor.tsx` - Processes shipment_items on arrival
- ✅ `src/types/database.ts` - ShipmentItem interfaces
- ✅ Backups created: `ShipmentCreator_OLD_backup.tsx`, `ShipmentMonitor_OLD_backup.tsx`

## Next Steps After Migration

1. Refresh your browser
2. Test creating a multi-item shipment
3. Add multiple products to the manifest
4. Dispatch and verify:
   - Quantities decrease at origin
   - Shipment shows "In Transit"
   - On arrival, quantities increase at destination
   - Multiple items processed correctly
