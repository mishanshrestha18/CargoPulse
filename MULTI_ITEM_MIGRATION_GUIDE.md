# Multi-Item Shipments Migration Guide

## Overview
This guide will help you migrate from single-item shipments to multi-item shipments using a manifest system.

## Step 1: Run Database Migration

Go to your Supabase Dashboard → SQL Editor and run this SQL:

```sql
-- Create shipment_items table for multi-item shipments
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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_inventory_id ON shipment_items(inventory_item_id);

-- Enable Row Level Security
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth requirements)
CREATE POLICY "Enable all operations for shipment_items" ON shipment_items
  FOR ALL USING (true) WITH CHECK (true);
```

Direct link: https://supabase.com/dashboard/project/gwkugefxjpocjwaymvjw/sql/new

## Step 2: Replace Components

### Replace ShipmentCreator.tsx

```bash
# Backup the old file
mv src/components/ShipmentCreator.tsx src/components/ShipmentCreator_OLD.tsx

# Use the new multi-item version
mv src/components/ShipmentCreator_MultiItem.tsx src/components/ShipmentCreator.tsx
```

### Replace ShipmentMonitor.tsx

```bash
# Backup the old file
mv src/components/ShipmentMonitor.tsx src/components/ShipmentMonitor_OLD.tsx

# Use the new multi-item version
mv src/components/ShipmentMonitor_MultiItem.tsx src/components/ShipmentMonitor.tsx
```

## Step 3: Verify Changes

The database types in `src/types/database.ts` have already been updated to include:
- `ShipmentItem` interface
- `ShipmentItemInsert` type
- Optional fields on `Shipment` for backward compatibility

## Key Features

### ShipmentCreator (Manifest Builder)

**New UI Flow:**
1. **Step 1:** Select Origin & Destination
2. **Step 2:** Select Product & Quantity
3. **Step 3:** Click "Add to Load" button
4. **Step 4:** Repeat Step 2-3 for more items
5. **Step 5:** Click "Dispatch Shipment" button

**Key Changes:**
- Manifest state management (array of items)
- "Add to Load" button instead of direct product list
- Visual manifest table showing all added items
- Allows multiple different products from same origin
- Single dispatch creates one shipment + multiple shipment_items

**Cost Calculation:**
- Sums value of all items in manifest
- Applies individual discounts per item
- Adds shipping distance cost
- Shows itemized breakdown

### ShipmentMonitor (Multi-Item Arrival)

**Arrival Logic:**
1. Fetches completed shipment
2. Fetches all `shipment_items` for that shipment
3. Loops through each item:
   - Checks if item exists at destination (by `item_name`)
   - **If exists:** UPDATE quantity += item.quantity
   - **If not exists:** INSERT new inventory row
4. Updates shipment status to 'Delivered'
5. Sets vehicle and driver to 'Idle'
6. Shows notification with item summary

## Testing

1. **Refresh your browser** after replacing the files
2. Create a new shipment:
   - Select France → Tokyo Hub
   - Add 10 Laptops → Click "Add to Load"
   - Add 5 Car Engine Parts → Click "Add to Load"
   - Review manifest (2 items, 15 total units)
   - Click "Dispatch Shipment"
3. Check database:
   - 1 row in `shipments` table
   - 2 rows in `shipment_items` table
4. Wait for arrival or manually finish
5. Verify inventory appears at Tokyo Hub

## Rollback Plan

If you need to revert to the old single-item system:

```bash
# Restore old components
mv src/components/ShipmentCreator_OLD.tsx src/components/ShipmentCreator.tsx
mv src/components/ShipmentMonitor_OLD.tsx src/components/ShipmentMonitor.tsx
```

The `shipment_items` table can remain in the database without causing issues.

## Notes

- Old shipments (single-item) will continue to work via backward compatibility
- New shipments use the manifest system with `shipment_items`
- The manifest builder validates stock in real-time
- Notifications show item count and summary
- All inventory transfer logic preserves price_per_unit and SKU
