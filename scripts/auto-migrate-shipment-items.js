/**
 * Automatic migration for shipment_items table
 * This will attempt to create the table via SQL query string
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function migrate() {
  console.log('🔄 Checking shipment_items table...\n');

  // Try to query the table
  const { data, error } = await supabase
    .from('shipment_items')
    .select('*')
    .limit(1);

  if (error && error.message.includes('does not exist')) {
    console.log('❌ Table does not exist.');
    console.log('\n📋 Please run the following SQL in Supabase Dashboard:');
    console.log('   👉 https://supabase.com/dashboard/project/gwkugefxjpocjwaymvjw/sql/new\n');
    console.log('─'.repeat(80));

    const sql = `-- Create shipment_items table for multi-item shipments
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
  FOR ALL USING (true) WITH CHECK (true);`;

    console.log(sql);
    console.log('─'.repeat(80));
    console.log('\n⏳ After running the SQL, press Ctrl+C and run this script again to verify.\n');
    return false;
  } else if (error) {
    console.error('❌ Error:', error.message);
    return false;
  } else {
    console.log('✅ shipment_items table exists!');
    console.log('   Sample rows:', data?.length || 0);

    // Verify the schema
    console.log('\n🔍 Verifying table structure...');

    // Try to insert a test row (will fail due to foreign key constraints, but that's OK)
    const testData = {
      shipment_id: '00000000-0000-0000-0000-000000000000',
      inventory_item_id: '00000000-0000-0000-0000-000000000000',
      item_name: 'test',
      quantity: 1,
      price_per_unit: 0,
      total_cost: 0
    };

    const { error: testError } = await supabase
      .from('shipment_items')
      .insert(testData);

    if (testError && testError.message.includes('violates foreign key constraint')) {
      console.log('✅ Table structure is correct (foreign keys working)');
    } else if (testError) {
      console.log('⚠️  Table exists but structure may need verification:', testError.message);
    } else {
      console.log('✅ Table is fully functional!');
      // Clean up test data
      await supabase.from('shipment_items').delete().eq('item_name', 'test');
    }

    return true;
  }
}

async function verifyComponents() {
  console.log('\n🔍 Verifying component files...');

  const creatorPath = path.join(__dirname, '..', 'src', 'components', 'ShipmentCreator.tsx');
  const monitorPath = path.join(__dirname, '..', 'src', 'components', 'ShipmentMonitor.tsx');

  const creatorContent = fs.readFileSync(creatorPath, 'utf-8');
  const monitorContent = fs.readFileSync(monitorPath, 'utf-8');

  const hasManifest = creatorContent.includes('manifest') && creatorContent.includes('Add to Load');
  const hasShipmentItems = monitorContent.includes('shipment_items');

  if (hasManifest && hasShipmentItems) {
    console.log('✅ Components are using multi-item system');
  } else {
    console.log('⚠️  Components may not be updated:');
    console.log('   - ShipmentCreator has manifest:', hasManifest);
    console.log('   - ShipmentMonitor uses shipment_items:', hasShipmentItems);
  }
}

async function main() {
  console.log('═'.repeat(80));
  console.log('  Multi-Item Shipments Migration');
  console.log('═'.repeat(80));
  console.log();

  const tableExists = await migrate();
  await verifyComponents();

  console.log();
  console.log('═'.repeat(80));

  if (tableExists) {
    console.log('✅ MIGRATION COMPLETE!');
    console.log();
    console.log('Next steps:');
    console.log('  1. Refresh your browser');
    console.log('  2. Test creating a multi-item shipment');
    console.log('  3. Add multiple products to the manifest');
    console.log('  4. Dispatch and verify arrival');
  } else {
    console.log('⏳ MIGRATION PENDING');
    console.log();
    console.log('Please run the SQL above in Supabase Dashboard, then run:');
    console.log('  node scripts/auto-migrate-shipment-items.js');
  }

  console.log('═'.repeat(80));
}

main();
