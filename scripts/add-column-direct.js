// Add delivery_location_id column directly using Supabase client
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('\u274c Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function addColumnDirectly() {
  console.log('🚀 Adding delivery_location_id column to shipment_items table\n');

  try {
    // Step 1: Add the column
    console.log('📝 Step 1: Adding delivery_location_id column...');

    // Use raw SQL execution via a simple query
    // First check if column exists
    const { data: checkData, error: checkError } = await supabase
      .from('shipment_items')
      .select('*')
      .limit(1);

    if (!checkError && checkData && checkData.length > 0) {
      const cols = Object.keys(checkData[0]);
      if (cols.includes('delivery_location_id')) {
        console.log('✅ Column already exists!');
      } else {
        console.log('⚠️  Column does not exist, need to add it via SQL');
        console.log('\n📋 Since I cannot execute DDL via the client, here is the corrected SQL:');
        console.log('\n' + '='.repeat(80));
        console.log(`
-- Step 1: Add the column (IF NOT EXISTS works here)
ALTER TABLE shipment_items
ADD COLUMN IF NOT EXISTS delivery_location_id BIGINT;

-- Step 2: Add foreign key constraint (drop first if exists to avoid error)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'shipment_items_delivery_location_fkey'
    ) THEN
        ALTER TABLE shipment_items
        ADD CONSTRAINT shipment_items_delivery_location_fkey
        FOREIGN KEY (delivery_location_id)
        REFERENCES locations(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- Step 3: Create index (IF NOT EXISTS works here)
CREATE INDEX IF NOT EXISTS idx_shipment_items_delivery_location
ON shipment_items(delivery_location_id);

-- Step 4: Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shipment_items'
AND column_name = 'delivery_location_id';
        `);
        console.log('='.repeat(80));
        console.log('\n📍 Run this in: https://supabase.com/dashboard/project/gwkugefxjpocjwaymvjw/sql/new');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addColumnDirectly();
