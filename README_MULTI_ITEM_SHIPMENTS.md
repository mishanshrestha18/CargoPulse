# Multi-Item Shipments Feature

## Overview

This feature allows creating shipments with multiple products (manifest builder) instead of just one product per shipment.

## Changes Made

### 1. Database Schema
- **New Table**: `shipment_items` - Stores individual items for each shipment
- **Fields**: id, shipment_id (FK), inventory_item_id (FK), item_name, quantity, price_per_unit, total_cost, created_at

### 2. TypeScript Types
- [src/types/database.ts](src/types/database.ts) - Added `ShipmentItem` and `ShipmentItemInsert` interfaces

### 3. Components Updated

#### [src/components/ShipmentCreator.tsx](src/components/ShipmentCreator.tsx)
- **Manifest Builder**: "Add to Load" button to build cargo list
- **Visual Table**: Shows all items in current manifest
- **Product Filtering**: Only shows products available at selected origin
- **Quantity Validation**: Ensures sufficient stock at origin
- **Cost Calculation**: Sums all items + shipping cost
- **Dispatch Logic**: Creates one shipment + multiple shipment_items records
- **Stock Decrement**: Reduces inventory quantities at origin immediately on dispatch

#### [src/components/ShipmentMonitor.tsx](src/components/ShipmentMonitor.tsx)
- **Multi-Item Processing**: Fetches all shipment_items for arriving shipments
- **Loop Transfer**: Processes each item individually on arrival
- **Inventory Upsert**: For each item:
  - Checks if item exists at destination by item_name
  - If exists: Updates quantity (adds to existing)
  - If not exists: Inserts new inventory record with all details

### 4. Backups Created
- `ShipmentCreator_OLD_backup.tsx` - Original single-item version
- `ShipmentMonitor_OLD_backup.tsx` - Original single-item version

## Migration Status

### Current Issue
Foreign key constraint error when creating `shipment_items` table. The error suggests UUID/BIGINT type mismatch.

### Diagnosis
- ✅ Created diagnostic tools
- ✅ Confirmed all IDs appear as numbers in data
- ⚠️ Error message contradicts data observation
- 🔍 Need to check actual PostgreSQL schema definition

### Migration Files
- `supabase/migrations/create_shipment_items_BIGINT.sql` - For BIGINT schemas
- `supabase/migrations/create_shipment_items_UUID.sql` - For UUID schemas

### Scripts Created
- `scripts/diagnose-schema.js` - Analyzes ID types in database
- `scripts/smart-migrate.js` - Provides correct migration SQL based on schema
- `scripts/auto-migrate-shipment-items.js` - Verifies migration success
- `scripts/check-table-schema.sql` - Direct PostgreSQL schema query

## How to Complete Migration

### Quick Start (Recommended)
```bash
node scripts/smart-migrate.js
```

This will:
1. Check if table already exists
2. Analyze your schema
3. Provide the correct SQL to run
4. Give you the direct link to Supabase Dashboard

### Manual Steps

1. **Run Smart Migration Script**:
   ```bash
   node scripts/smart-migrate.js
   ```

2. **Copy the SQL** it outputs

3. **Open Supabase SQL Editor**:
   https://supabase.com/dashboard/project/gwkugefxjpocjwaymvjw/sql/new

4. **Paste and Run** the SQL

5. **Verify Migration**:
   ```bash
   node scripts/auto-migrate-shipment-items.js
   ```

   You should see:
   ```
   ✅ shipment_items table exists!
   ✅ Components are using multi-item system
   ✅ MIGRATION COMPLETE!
   ```

### If BIGINT Migration Fails

If you get UUID error with BIGINT migration:
1. Run the UUID version: `supabase/migrations/create_shipment_items_UUID.sql`
2. Update [src/types/database.ts](src/types/database.ts) to use `string` types for IDs:
   ```typescript
   export interface ShipmentItem {
     id: string;  // Change from number
     shipment_id: string;  // Change from number
     inventory_item_id: string;  // Change from number
     // ... rest stays the same
   }
   ```

## Testing the Feature

After successful migration:

1. **Refresh Browser** - Clear any cached state

2. **Create Multi-Item Shipment**:
   - Select origin (e.g., "France")
   - Select destination (e.g., "Tokyo Hub")
   - Select driver and vehicle
   - Choose urgency and shipping method
   - **Add multiple products**:
     - Select product → Enter quantity → Click "Add to Load"
     - Repeat for 2-3 different products
   - Review manifest table showing all items
   - Click "Dispatch"

3. **Verify Inventory Decrements**:
   - Check origin location inventory
   - All quantities should be reduced by shipment amounts

4. **Monitor Shipment**:
   - Watch shipment status (In Transit → Delivered)
   - Active Shipments list should show the shipment

5. **Verify Arrival**:
   - Wait for auto-arrival or click "Finish" button
   - Check destination location inventory
   - All items should appear with correct quantities
   - If items already existed, quantities should be increased

6. **Check Notifications**:
   - Toast popup on dispatch
   - Toast popup on arrival
   - Notification sidebar should show both events
   - Browser notification on arrival (if permitted)

## Feature Flow

```
User Creates Shipment
        ↓
Selects Origin/Destination
        ↓
Builds Manifest (Add to Load)
        ↓
Reviews Total Cost
        ↓
Dispatches Shipment
        ↓
Creates:
  - 1 shipment record
  - N shipment_items records
  - Decrements N inventory records at origin
        ↓
ShipmentMonitor Watches
        ↓
On Arrival Detected
        ↓
Fetches all shipment_items
        ↓
For Each Item:
  - Check if exists at destination
  - UPDATE or INSERT inventory
        ↓
Shows Notifications
        ↓
Updates Dashboard Charts
```

## Troubleshooting

### Table Creation Fails
- Run `scripts/smart-migrate.js` to get correct SQL
- Check actual schema with `scripts/check-table-schema.sql`
- Try UUID migration if BIGINT fails

### Products Not Showing
- Verify origin is selected first
- Check that products have quantity > 0
- Ensure product.location matches selected origin name

### Inventory Not Transferring on Arrival
- Check ShipmentMonitor is running (should be automatic)
- Verify shipment_items records were created
- Check browser console for errors
- Try manual "Finish" button on active shipment

### TypeScript Errors
- If using UUID migration, update types to `string`
- If using BIGINT migration, types should be `number`
- Restart TypeScript server if needed

## Architecture Decisions

### Why Separate shipment_items Table?
- Normalization: Avoid data duplication
- Flexibility: Support unlimited items per shipment
- Integrity: Foreign keys maintain data consistency
- Scalability: Easy to query and aggregate

### Why Store item_name in shipment_items?
- Historical record: Preserves item name even if inventory changes
- Simplicity: Easy upsert logic at destination
- Performance: Avoid extra joins for common queries

### Why Upsert Logic?
- Flexibility: Handle both new and existing products at destination
- Correctness: Don't create duplicate inventory records
- Real-world: Models actual warehouse receiving process

## Files Reference

### Core Components
- [src/components/ShipmentCreator.tsx](src/components/ShipmentCreator.tsx) - 1140 lines
- [src/components/ShipmentMonitor.tsx](src/components/ShipmentMonitor.tsx) - 202 lines
- [src/types/database.ts](src/types/database.ts) - Type definitions

### Migration Files
- [supabase/migrations/create_shipment_items_BIGINT.sql](supabase/migrations/create_shipment_items_BIGINT.sql)
- [supabase/migrations/create_shipment_items_UUID.sql](supabase/migrations/create_shipment_items_UUID.sql)

### Utility Scripts
- [scripts/smart-migrate.js](scripts/smart-migrate.js) - Intelligent migration helper
- [scripts/diagnose-schema.js](scripts/diagnose-schema.js) - Schema analyzer
- [scripts/auto-migrate-shipment-items.js](scripts/auto-migrate-shipment-items.js) - Verification tool
- [scripts/check-table-schema.sql](scripts/check-table-schema.sql) - Direct schema query

### Documentation
- [MIGRATION_INSTRUCTIONS.md](MIGRATION_INSTRUCTIONS.md) - Detailed migration guide
- [README_MULTI_ITEM_SHIPMENTS.md](README_MULTI_ITEM_SHIPMENTS.md) - This file

## Next Steps

1. ✅ Run migration (see "How to Complete Migration" above)
2. ✅ Test feature (see "Testing the Feature" above)
3. Optional: Add validation for total shipment weight/volume
4. Optional: Add item categories and filtering
5. Optional: Add manifest PDF export
6. Optional: Add barcode scanning for items
