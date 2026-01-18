// Add delivery_location_id column to shipment_items table
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gwkugefxjpocjwaymvjw.supabase.co';
const serviceRoleKey = '***REMOVED-SUPABASE-KEY***';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: 'public' }
});

async function addColumn() {
  console.log('🚀 Adding delivery_location_id column to shipment_items table\n');

  try {
    // Check if column already exists
    console.log('🔍 Checking current schema...');
    const { data: existingColumns, error: schemaError } = await supabase
      .from('shipment_items')
      .select('*')
      .limit(1);

    if (schemaError) {
      console.error('❌ Error checking schema:', schemaError);
    } else {
      console.log('✅ shipment_items table accessible');
      if (existingColumns && existingColumns.length > 0) {
        const keys = Object.keys(existingColumns[0]);
        console.log('   Current columns:', keys.join(', '));

        if (keys.includes('delivery_location_id')) {
          console.log('\n✅ Column delivery_location_id already exists!');
          console.log('   No migration needed.');
          return;
        }
      }
    }

    console.log('\n⚠️  Column delivery_location_id does NOT exist');
    console.log('   Please run this SQL in your Supabase SQL Editor:');
    console.log('\n' + '='.repeat(70));
    console.log(`
-- Add delivery_location_id column to shipment_items table
ALTER TABLE shipment_items
ADD COLUMN IF NOT EXISTS delivery_location_id BIGINT;

-- Add foreign key constraint
ALTER TABLE shipment_items
ADD CONSTRAINT shipment_items_delivery_location_fkey
FOREIGN KEY (delivery_location_id)
REFERENCES locations(id)
ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_shipment_items_delivery_location
ON shipment_items(delivery_location_id);

-- Backfill existing records with shipment's destination
UPDATE shipment_items si
SET delivery_location_id = s.destination_location_id
FROM shipments s
WHERE si.shipment_id = s.id
AND si.delivery_location_id IS NULL;
    `);
    console.log('='.repeat(70));
    console.log('\n📋 Instructions:');
    console.log('   1. Go to https://supabase.com/dashboard/project/gwkugefxjpocjwaymvjw/sql');
    console.log('   2. Copy and paste the SQL above');
    console.log('   3. Click "Run"');
    console.log('   4. Come back and run this script again to verify\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addColumn();
