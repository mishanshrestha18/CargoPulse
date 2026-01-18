// Script to test hybrid routing with a cross-ocean shipment
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testHybridRoute() {
  console.log('🧪 Testing Hybrid Route (Cross-Ocean Shipment)...\n');

  // 1. First ensure we have a European location
  console.log('📍 Checking for European location...');

  const { data: londonLocation } = await supabase
    .from('locations')
    .select('*')
    .eq('name', 'London Warehouse')
    .single();

  let europeanLoc = londonLocation;

  if (!londonLocation) {
    console.log('   Adding London Warehouse...');
    const { data: newLoc, error } = await supabase
      .from('locations')
      .insert([{
        name: 'London Warehouse',
        type: 'warehouse',
        latitude: 51.5074,
        longitude: -0.1278,
      }])
      .select()
      .single();

    if (error) {
      console.log('❌ Failed to create London location:', error.message);
      return;
    }
    europeanLoc = newLoc;
    console.log('   ✅ Created London Warehouse (ID:', europeanLoc.id, ')');
  } else {
    console.log('   ✅ Found London Warehouse (ID:', europeanLoc.id, ')');
  }

  // 2. Get a US location
  const { data: usLocations } = await supabase
    .from('locations')
    .select('*');

  const usLocation = usLocations?.find(loc =>
    loc.longitude < -60 && loc.longitude > -130
  );

  if (!usLocation) {
    console.log('❌ No US location found');
    return;
  }

  console.log('   ✅ Found US location:', usLocation.name, '(ID:', usLocation.id, ')');

  // 3. Get idle driver and vehicle
  const { data: drivers } = await supabase
    .from('drivers')
    .select('*')
    .eq('status', 'Idle')
    .limit(1);

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .eq('status', 'Idle')
    .limit(1);

  if (!drivers?.length || !vehicles?.length) {
    console.log('❌ No idle drivers or vehicles');
    // Reset one driver and vehicle
    await supabase.from('drivers').update({ status: 'Idle' }).neq('id', 0).limit(1);
    await supabase.from('vehicles').update({ status: 'Idle' }).neq('id', 0).limit(1);

    const { data: newDrivers } = await supabase.from('drivers').select('*').eq('status', 'Idle').limit(1);
    const { data: newVehicles } = await supabase.from('vehicles').select('*').eq('status', 'Idle').limit(1);

    if (!newDrivers?.length || !newVehicles?.length) {
      console.log('❌ Still no idle drivers or vehicles');
      return;
    }

    drivers.length = 0;
    drivers.push(...newDrivers);
    vehicles.length = 0;
    vehicles.push(...newVehicles);
  }

  console.log('\n🚚 Creating cross-ocean shipment...');
  console.log(`   From: ${usLocation.name} (${usLocation.latitude.toFixed(2)}, ${usLocation.longitude.toFixed(2)})`);
  console.log(`   To: ${europeanLoc.name} (${europeanLoc.latitude.toFixed(2)}, ${europeanLoc.longitude.toFixed(2)})`);
  console.log(`   Driver: ${drivers[0].name}`);
  console.log(`   Vehicle: ${vehicles[0].name}`);

  // Calculate arrival time (4 hours from now for cross-ocean)
  const arrivalTime = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  // 4. Create the shipment
  const { data: shipment, error: shipmentError } = await supabase
    .from('shipments')
    .insert([{
      driver_id: drivers[0].id,
      vehicle_id: vehicles[0].id,
      origin: usLocation.id,
      destination: europeanLoc.id,
      arrival_time: arrivalTime,
      status: 'In Transit',
      urgency: 'express',
      total_cost: 8500.00,
      shipping_method: 'truck', // Set as truck to test hybrid routing
    }])
    .select()
    .single();

  if (shipmentError) {
    console.log('❌ Failed to create shipment:', shipmentError.message);
    return;
  }

  console.log(`\n✅ Created shipment ID: ${shipment.id}`);

  // Update driver and vehicle status
  await supabase.from('drivers').update({ status: 'Busy' }).eq('id', drivers[0].id);
  await supabase.from('vehicles').update({ status: 'In Transit' }).eq('id', vehicles[0].id);

  console.log('\n═══════════════════════════════════════');
  console.log('📊 VERIFICATION');
  console.log('═══════════════════════════════════════');
  console.log(`\n✅ Cross-ocean shipment created!`);
  console.log(`   Shipment ${shipment.id}: ${usLocation.name} → ${europeanLoc.name}`);
  console.log(`   Method: ${shipment.shipping_method}`);
  console.log(`   This should display as a HYBRID route on the map`);
  console.log(`   - Amber/yellow line for ground segments`);
  console.log(`   - Blue dashed line for air (ocean crossing) segment`);
  console.log('\n🌐 Open the app to see the hybrid route visualization!');
}

testHybridRoute().catch(console.error);
