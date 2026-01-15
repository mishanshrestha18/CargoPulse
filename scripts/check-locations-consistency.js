/**
 * Check locations consistency between locations table and inventory
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

async function checkConsistency() {
  console.log('📍 Current locations in database:\n');

  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .order('name');

  locations.forEach(loc => {
    console.log(`  ID: ${loc.id}, Name: '${loc.name}', Type: ${loc.type}`);
  });

  console.log('\n📦 Inventory location distribution:\n');

  const { data: inventory } = await supabase
    .from('inventory')
    .select('location');

  const locationCounts = {};
  inventory.forEach(item => {
    locationCounts[item.location] = (locationCounts[item.location] || 0) + 1;
  });

  Object.entries(locationCounts).sort().forEach(([loc, count]) => {
    const match = locations.find(l => l.name === loc);
    const status = match ? '✅' : '❌';
    console.log(`  ${status} '${loc}': ${count} items`);
  });

  console.log('\n📋 Summary:\n');
  const invalidLocations = Object.keys(locationCounts).filter(loc =>
    !locations.find(l => l.name === loc)
  );

  if (invalidLocations.length > 0) {
    console.log('⚠️  Found inventory items at non-existent locations:');
    invalidLocations.forEach(loc => {
      console.log(`   - '${loc}' (${locationCounts[loc]} items)`);
    });
    console.log('\n💡 These should be fixed to match actual location names.');
  } else {
    console.log('✅ All inventory locations match the locations table!');
  }
}

checkConsistency();
