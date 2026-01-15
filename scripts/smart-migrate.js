/**
 * Smart migration that attempts both UUID and BIGINT approaches
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const trimmedLine = line.trim();
  if (trimmedLine && !trimmedLine.startsWith('#')) {
    const match = trimmedLine.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && value) {
        envVars[key] = value;
      }
    }
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function tryMigration() {
  console.log('═'.repeat(80));
  console.log('  Smart Migration for shipment_items Table');
  console.log('═'.repeat(80));
  console.log();

  // First, check if table already exists
  console.log('🔍 Checking if shipment_items table exists...');
  const { data: existingCheck, error: existingError } = await supabase
    .from('shipment_items')
    .select('id')
    .limit(1);

  if (!existingError) {
    console.log('✅ Table already exists!');
    console.log('   Sample data:', existingCheck);
    console.log();
    console.log('No migration needed.');
    console.log('═'.repeat(80));
    return;
  }

  console.log('❌ Table does not exist yet.');
  console.log();

  // Try to determine ID type from existing shipment
  console.log('📊 Analyzing existing schema...');
  const { data: sampleShipment, error: shipError } = await supabase
    .from('shipments')
    .select('id, driver_id, vehicle_id')
    .limit(1)
    .single();

  if (shipError) {
    console.log('❌ Error reading shipments:', shipError.message);
    return;
  }

  console.log('   Sample shipment ID:', sampleShipment.id, `(${typeof sampleShipment.id})`);
  console.log();

  // Provide instructions based on data type
  const idType = typeof sampleShipment.id;

  console.log('═'.repeat(80));
  console.log('📋 MANUAL MIGRATION REQUIRED');
  console.log('═'.repeat(80));
  console.log();

  console.log('⚠️  Cannot run DDL statements via JavaScript client.');
  console.log('   You need to run the SQL manually in Supabase Dashboard.');
  console.log();

  if (idType === 'string') {
    console.log('✅ IDs appear to be strings → Use UUID migration');
    console.log();
    console.log('🔗 Open Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/gwkugefxjpocjwaymvjw/sql/new');
    console.log();
    console.log('📄 Run this SQL:');
    console.log('─'.repeat(80));
    console.log(fs.readFileSync(
      path.join(__dirname, '..', 'supabase', 'migrations', 'create_shipment_items_UUID.sql'),
      'utf-8'
    ));
    console.log('─'.repeat(80));
  } else {
    console.log('✅ IDs appear to be numbers → Try BIGINT migration first');
    console.log();
    console.log('🔗 Open Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/gwkugefxjpocjwaymvjw/sql/new');
    console.log();
    console.log('📄 Run this SQL:');
    console.log('─'.repeat(80));
    console.log(fs.readFileSync(
      path.join(__dirname, '..', 'supabase', 'migrations', 'create_shipment_items_BIGINT.sql'),
      'utf-8'
    ));
    console.log('─'.repeat(80));
    console.log();
    console.log('❗ If that fails with UUID error, try the UUID version:');
    console.log('   supabase/migrations/create_shipment_items_UUID.sql');
  }

  console.log();
  console.log('═'.repeat(80));
  console.log('⏳ After running the SQL, run this script again to verify:');
  console.log('   node scripts/auto-migrate-shipment-items.js');
  console.log('═'.repeat(80));
}

tryMigration();
