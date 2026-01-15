/**
 * Diagnose the actual schema types by examining existing data patterns
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

async function diagnose() {
  console.log('═'.repeat(80));
  console.log('  Schema Type Diagnosis');
  console.log('═'.repeat(80));
  console.log();

  // Check shipments table
  console.log('📊 Checking shipments table...');
  const { data: shipments, error: shipError } = await supabase
    .from('shipments')
    .select('id, driver_id, vehicle_id')
    .limit(3);

  if (shipError) {
    console.log('❌ Error:', shipError.message);
  } else {
    console.log('✅ Sample shipments:');
    shipments.forEach(s => {
      console.log(`   ID: ${s.id} (${typeof s.id}) - Driver: ${s.driver_id} - Vehicle: ${s.vehicle_id}`);
    });
  }

  console.log();

  // Check inventory table
  console.log('📦 Checking inventory table...');
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('id, item_name')
    .limit(3);

  if (invError) {
    console.log('❌ Error:', invError.message);
  } else {
    console.log('✅ Sample inventory:');
    inventory.forEach(i => {
      console.log(`   ID: ${i.id} (${typeof i.id}) - Item: ${i.item_name}`);
    });
  }

  console.log();

  // Check drivers table
  console.log('🚗 Checking drivers table...');
  const { data: drivers, error: driverError } = await supabase
    .from('drivers')
    .select('id, name')
    .limit(3);

  if (driverError) {
    console.log('❌ Error:', driverError.message);
  } else {
    console.log('✅ Sample drivers:');
    drivers.forEach(d => {
      console.log(`   ID: ${d.id} (${typeof d.id}) - Name: ${d.name}`);
    });
  }

  console.log();

  // Check vehicles table
  console.log('🚚 Checking vehicles table...');
  const { data: vehicles, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id, name')
    .limit(3);

  if (vehicleError) {
    console.log('❌ Error:', vehicleError.message);
  } else {
    console.log('✅ Sample vehicles:');
    vehicles.forEach(v => {
      console.log(`   ID: ${v.id} (${typeof v.id}) - Name: ${v.name}`);
    });
  }

  console.log();
  console.log('═'.repeat(80));
  console.log('📋 Analysis:');
  console.log();

  if (shipments && inventory && drivers && vehicles) {
    const shipmentIdType = typeof shipments[0]?.id;
    const inventoryIdType = typeof inventory[0]?.id;
    const driverIdType = typeof drivers[0]?.id;
    const vehicleIdType = typeof vehicles[0]?.id;

    console.log(`   Shipments ID type: ${shipmentIdType}`);
    console.log(`   Inventory ID type: ${inventoryIdType}`);
    console.log(`   Drivers ID type: ${driverIdType}`);
    console.log(`   Vehicles ID type: ${vehicleIdType}`);
    console.log();

    if (shipmentIdType === 'number') {
      console.log('✅ All IDs appear to be numbers (BIGINT/INTEGER in PostgreSQL)');
      console.log('   Migration should use: BIGINT');
      console.log();
      console.log('⚠️  But the error suggests UUID type mismatch...');
      console.log('   This could mean:');
      console.log('   1. The table schema uses UUID but stores numeric values');
      console.log('   2. There\'s a type coercion happening');
      console.log('   3. The error message is misleading');
    } else if (shipmentIdType === 'string') {
      console.log('✅ All IDs appear to be strings (likely UUID in PostgreSQL)');
      console.log('   Migration should use: UUID');
    }
  }

  console.log();
  console.log('═'.repeat(80));
  console.log('🔧 Recommended Action:');
  console.log();
  console.log('Run this query in Supabase SQL Editor to get definitive answer:');
  console.log('https://supabase.com/dashboard/project/gwkugefxjpocjwaymvjw/sql/new');
  console.log();
  console.log('─'.repeat(80));
  console.log(fs.readFileSync(path.join(__dirname, 'check-table-schema.sql'), 'utf-8'));
  console.log('─'.repeat(80));
  console.log();
  console.log('This will show the actual PostgreSQL column types (bigint, uuid, etc.)');
  console.log('═'.repeat(80));
}

diagnose();
