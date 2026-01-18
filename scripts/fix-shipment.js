// Script to fix the problematic shipment
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixShipment() {
  console.log('🔧 Fixing problematic shipment...\n');

  // 1. Cancel the problematic shipment (ID 37 - goes across ocean)
  console.log('❌ Cancelling shipment 37 (cross-ocean route)...');

  const { data: shipment37 } = await supabase
    .from('shipments')
    .select('driver_id, vehicle_id')
    .eq('id', 37)
    .single();

  if (shipment37) {
    // Reset driver and vehicle
    await supabase.from('drivers').update({ status: 'Idle' }).eq('id', shipment37.driver_id);
    await supabase.from('vehicles').update({ status: 'Idle' }).eq('id', shipment37.vehicle_id);

    // Cancel shipment
    await supabase.from('shipments').update({ status: 'Cancelled' }).eq('id', 37);
    console.log('✅ Shipment 37 cancelled, driver and vehicle reset to Idle');
  }

  // 2. Get US-only locations for a valid route
  console.log('\n📍 Finding US locations for valid route...');

  const { data: locations } = await supabase
    .from('locations')
    .select('*');

  // Filter for US locations (longitude between -130 and -60)
  const usLocations = locations?.filter(loc =>
    loc.longitude < -60 && loc.longitude > -130
  ) || [];

  console.log(`Found ${usLocations.length} US locations:`);
  usLocations.forEach(loc => {
    console.log(`  - [${loc.id}] ${loc.name} @ ${loc.latitude.toFixed(2)}, ${loc.longitude.toFixed(2)}`);
  });

  if (usLocations.length < 3) {
    console.log('\n⚠️ Need at least 3 US locations. Current US locations may not be enough.');
    return;
  }

  // 3. Get an idle driver and vehicle
  const { data: drivers } = await supabase
    .from('drivers')
    .select('*')
    .eq('status', 'Idle')
    .limit(1);

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .eq('status', 'Idle')
    .neq('type', 'Plane')
    .limit(1);

  if (!drivers?.length || !vehicles?.length) {
    console.log('❌ No idle drivers or vehicles available');

    // Reset all to idle
    await supabase.from('drivers').update({ status: 'Idle' }).neq('id', 0);
    await supabase.from('vehicles').update({ status: 'Idle' }).neq('id', 0);
    console.log('✅ Reset all drivers and vehicles to Idle');

    // Refetch
    const { data: newDrivers } = await supabase.from('drivers').select('*').eq('status', 'Idle').limit(1);
    const { data: newVehicles } = await supabase.from('vehicles').select('*').eq('status', 'Idle').neq('type', 'Plane').limit(1);

    if (!newDrivers?.length || !newVehicles?.length) {
      console.log('❌ Still no drivers or vehicles available');
      return;
    }

    drivers.length = 0;
    drivers.push(...newDrivers);
    vehicles.length = 0;
    vehicles.push(...newVehicles);
  }

  // 4. Create a new shipment with US-only route
  // JFK Airport → Chicago Hub → Dallas Logistics (all in US)
  const origin = usLocations.find(l => l.name.includes('JFK') || l.name.includes('Airport')) || usLocations[0];
  const stop1 = usLocations.find(l => l.name.includes('Chicago')) || usLocations[1];
  const destination = usLocations.find(l => l.name.includes('Dallas')) || usLocations[usLocations.length - 1];

  // Make sure they're all different
  if (origin.id === stop1?.id || origin.id === destination.id || stop1?.id === destination.id) {
    console.log('⚠️ Cannot create route - locations overlap');
    console.log(`   Origin: ${origin.name} (${origin.id})`);
    console.log(`   Stop: ${stop1?.name} (${stop1?.id})`);
    console.log(`   Dest: ${destination.name} (${destination.id})`);
    return;
  }

  console.log('\n🚚 Creating new US-only shipment...');
  console.log(`   Origin: ${origin.name}`);
  console.log(`   Stop 1: ${stop1.name}`);
  console.log(`   Destination: ${destination.name}`);
  console.log(`   Driver: ${drivers[0].name}`);
  console.log(`   Vehicle: ${vehicles[0].name}`);

  // Calculate arrival time (2 hours from now)
  const arrivalTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const { data: newShipment, error: shipmentError } = await supabase
    .from('shipments')
    .insert([{
      driver_id: drivers[0].id,
      vehicle_id: vehicles[0].id,
      origin: origin.id,
      destination: destination.id,
      arrival_time: arrivalTime,
      status: 'In Transit',
      urgency: 'standard',
      total_cost: 2500.00,
      shipping_method: 'truck',
    }])
    .select()
    .single();

  if (shipmentError) {
    console.log('❌ Failed to create shipment:', shipmentError.message);
    return;
  }

  console.log(`\n✅ Created shipment ID: ${newShipment.id}`);

  // Add intermediate stop
  const { error: stopError } = await supabase
    .from('shipment_stops')
    .insert([{
      shipment_id: newShipment.id,
      location_id: stop1.id,
      stop_order: 1,
      notes: 'Pickup at Chicago distribution center',
    }]);

  if (stopError) {
    console.log('❌ Failed to create stop:', stopError.message);
  } else {
    console.log(`✅ Added stop at ${stop1.name}`);
  }

  // Update driver and vehicle status
  await supabase.from('drivers').update({ status: 'Busy' }).eq('id', drivers[0].id);
  await supabase.from('vehicles').update({ status: 'In Transit' }).eq('id', vehicles[0].id);

  // 5. Verify
  console.log('\n═══════════════════════════════════════');
  console.log('📊 VERIFICATION');
  console.log('═══════════════════════════════════════');

  const { data: activeShipments } = await supabase
    .from('shipments')
    .select('id, origin, destination, status, shipping_method')
    .eq('status', 'In Transit');

  console.log(`\n🚚 Active shipments: ${activeShipments?.length || 0}`);

  for (const ship of activeShipments || []) {
    const originLoc = locations?.find(l => l.id == ship.origin);
    const destLoc = locations?.find(l => l.id == ship.destination);

    const { data: stops } = await supabase
      .from('shipment_stops')
      .select('*, locations(name)')
      .eq('shipment_id', ship.id);

    console.log(`\n   Shipment ${ship.id}:`);
    console.log(`   - Route: ${originLoc?.name} → ${destLoc?.name}`);
    console.log(`   - Method: ${ship.shipping_method}`);
    console.log(`   - Stops: ${stops?.length || 0}`);
    stops?.forEach(s => {
      console.log(`     • Stop ${s.stop_order}: ${s.locations?.name || 'Unknown'}`);
    });
  }

  console.log('\n✅ Fix complete! The map should now load correctly.');
}

fixShipment().catch(console.error);
