// Script to create test shipment with stops and add sample data
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestData() {
  console.log('🚀 Creating test data...\n');

  // 1. First, let's check existing locations
  console.log('═══════════════════════════════════════');
  console.log('📍 CHECKING LOCATIONS');
  console.log('═══════════════════════════════════════');

  const { data: locations, error: locError } = await supabase
    .from('locations')
    .select('*');

  if (locError) {
    console.error('❌ Error fetching locations:', locError.message);
    return;
  }

  console.log(`Found ${locations.length} locations:`);
  locations.forEach(loc => {
    console.log(`  - [${loc.id}] ${loc.name} (${loc.type}) @ ${loc.latitude}, ${loc.longitude}`);
  });

  // If we need more locations, add them
  if (locations.length < 5) {
    console.log('\n📍 Adding more locations...');
    const newLocations = [
      { name: 'Chicago Hub', type: 'warehouse', latitude: 41.8781, longitude: -87.6298 },
      { name: 'Denver Distribution', type: 'warehouse', latitude: 39.7392, longitude: -104.9903 },
      { name: 'Seattle Port', type: 'port', latitude: 47.6062, longitude: -122.3321 },
      { name: 'Miami Warehouse', type: 'warehouse', latitude: 25.7617, longitude: -80.1918 },
      { name: 'Dallas Logistics', type: 'warehouse', latitude: 32.7767, longitude: -96.7970 },
    ];

    for (const loc of newLocations) {
      const { data: existing } = await supabase
        .from('locations')
        .select('id')
        .eq('name', loc.name)
        .single();

      if (!existing) {
        const { data, error } = await supabase
          .from('locations')
          .insert([loc])
          .select()
          .single();

        if (error) {
          console.log(`  ❌ Failed to add ${loc.name}: ${error.message}`);
        } else {
          console.log(`  ✅ Added ${loc.name} (ID: ${data.id})`);
        }
      } else {
        console.log(`  ⏭️ ${loc.name} already exists`);
      }
    }

    // Refetch locations
    const { data: updatedLocations } = await supabase.from('locations').select('*');
    locations.length = 0;
    locations.push(...(updatedLocations || []));
  }

  // 2. Check drivers - add more if needed
  console.log('\n═══════════════════════════════════════');
  console.log('👨‍✈️ CHECKING DRIVERS');
  console.log('═══════════════════════════════════════');

  const { data: drivers } = await supabase.from('drivers').select('*');
  console.log(`Found ${drivers?.length || 0} drivers`);

  // Reset all drivers to Idle for testing
  const { error: resetDriversError } = await supabase
    .from('drivers')
    .update({ status: 'Idle' })
    .neq('id', 0); // Update all

  if (!resetDriversError) {
    console.log('✅ Reset all drivers to Idle status');
  }

  // Add more drivers if needed
  if ((drivers?.length || 0) < 5) {
    const newDrivers = [
      { name: 'John Smith', status: 'Idle', phone: '555-0101' },
      { name: 'Maria Garcia', status: 'Idle', phone: '555-0102' },
      { name: 'James Wilson', status: 'Idle', phone: '555-0103' },
      { name: 'Sarah Johnson', status: 'Idle', phone: '555-0104' },
      { name: 'Michael Brown', status: 'Idle', phone: '555-0105' },
    ];

    for (const driver of newDrivers) {
      const { data: existing } = await supabase
        .from('drivers')
        .select('id')
        .eq('name', driver.name)
        .single();

      if (!existing) {
        const { data, error } = await supabase
          .from('drivers')
          .insert([driver])
          .select()
          .single();

        if (!error) {
          console.log(`  ✅ Added driver: ${driver.name}`);
        }
      }
    }
  }

  // 3. Check vehicles - add more if needed
  console.log('\n═══════════════════════════════════════');
  console.log('🚛 CHECKING VEHICLES');
  console.log('═══════════════════════════════════════');

  const { data: vehicles } = await supabase.from('vehicles').select('*');
  console.log(`Found ${vehicles?.length || 0} vehicles`);

  // Reset all vehicles to Idle for testing
  const { error: resetVehiclesError } = await supabase
    .from('vehicles')
    .update({ status: 'Idle' })
    .neq('id', 0);

  if (!resetVehiclesError) {
    console.log('✅ Reset all vehicles to Idle status');
  }

  // Add more vehicles if needed
  if ((vehicles?.length || 0) < 5) {
    const newVehicles = [
      { name: 'Truck Alpha', type: 'Heavy Truck', status: 'Idle', capacity: 20000 },
      { name: 'Truck Beta', type: 'Medium Truck', status: 'Idle', capacity: 10000 },
      { name: 'Van Express', type: 'Van', status: 'Idle', capacity: 3000 },
      { name: 'Cargo Plane A1', type: 'Plane', status: 'Idle', capacity: 50000 },
      { name: 'Freight Jet B2', type: 'Plane', status: 'Idle', capacity: 30000 },
    ];

    for (const vehicle of newVehicles) {
      const { data: existing } = await supabase
        .from('vehicles')
        .select('id')
        .eq('name', vehicle.name)
        .single();

      if (!existing) {
        const { data, error } = await supabase
          .from('vehicles')
          .insert([vehicle])
          .select()
          .single();

        if (!error) {
          console.log(`  ✅ Added vehicle: ${vehicle.name}`);
        }
      }
    }
  }

  // 4. Check and add inventory
  console.log('\n═══════════════════════════════════════');
  console.log('📦 CHECKING INVENTORY');
  console.log('═══════════════════════════════════════');

  // Get a location name for inventory
  const { data: allLocations } = await supabase.from('locations').select('*');
  const firstLocation = allLocations?.[0];

  if (firstLocation) {
    const { data: inventory } = await supabase
      .from('inventory')
      .select('*')
      .eq('location', firstLocation.name);

    console.log(`Found ${inventory?.length || 0} inventory items at ${firstLocation.name}`);

    // Add sample inventory if needed
    if ((inventory?.length || 0) < 5) {
      const newItems = [
        { sku: 'ELEC-001', item_name: 'Laptop Pro 15', quantity: 500, location: firstLocation.name, status: 'In Stock', price_per_unit: 1200.00, max_discount: 15, discount_tier_1_qty: 10, discount_tier_1_percent: 5, discount_tier_2_qty: 50, discount_tier_2_percent: 10, discount_tier_3_qty: 100, discount_tier_3_percent: 15 },
        { sku: 'ELEC-002', item_name: 'Wireless Mouse', quantity: 1000, location: firstLocation.name, status: 'In Stock', price_per_unit: 35.00, max_discount: 20, discount_tier_1_qty: 20, discount_tier_1_percent: 5, discount_tier_2_qty: 100, discount_tier_2_percent: 10, discount_tier_3_qty: 500, discount_tier_3_percent: 15 },
        { sku: 'ELEC-003', item_name: 'USB-C Hub', quantity: 750, location: firstLocation.name, status: 'In Stock', price_per_unit: 75.00, max_discount: 15 },
        { sku: 'AUTO-001', item_name: 'Brake Pads Set', quantity: 200, location: firstLocation.name, status: 'In Stock', price_per_unit: 89.99, max_discount: 10 },
        { sku: 'AUTO-002', item_name: 'Oil Filter Premium', quantity: 300, location: firstLocation.name, status: 'In Stock', price_per_unit: 24.99, max_discount: 15 },
      ];

      for (const item of newItems) {
        const { data: existing } = await supabase
          .from('inventory')
          .select('id')
          .eq('sku', item.sku)
          .single();

        if (!existing) {
          const { error } = await supabase
            .from('inventory')
            .insert([item]);

          if (!error) {
            console.log(`  ✅ Added inventory: ${item.item_name} (${item.quantity} units)`);
          }
        }
      }
    }
  }

  // 5. Create a test shipment with intermediate stops
  console.log('\n═══════════════════════════════════════');
  console.log('🚚 CREATING TEST SHIPMENT WITH STOPS');
  console.log('═══════════════════════════════════════');

  // Get fresh data
  const { data: freshLocations } = await supabase.from('locations').select('*');
  const { data: freshDrivers } = await supabase.from('drivers').select('*').eq('status', 'Idle').limit(1);
  const { data: freshVehicles } = await supabase.from('vehicles').select('*').eq('status', 'Idle').neq('type', 'Plane').limit(1);
  const { data: freshInventory } = await supabase.from('inventory').select('*').gt('quantity', 10).limit(2);

  if (!freshLocations || freshLocations.length < 3) {
    console.log('❌ Need at least 3 locations for a multi-stop shipment');
    return;
  }

  if (!freshDrivers || freshDrivers.length === 0) {
    console.log('❌ No idle drivers available');
    return;
  }

  if (!freshVehicles || freshVehicles.length === 0) {
    console.log('❌ No idle vehicles available');
    return;
  }

  const origin = freshLocations[0];
  const stop1 = freshLocations.length > 2 ? freshLocations[1] : null;
  const destination = freshLocations[freshLocations.length - 1];
  const driver = freshDrivers[0];
  const vehicle = freshVehicles[0];

  console.log(`\n📋 Shipment Details:`);
  console.log(`   Origin: ${origin.name}`);
  if (stop1 && stop1.id !== origin.id && stop1.id !== destination.id) {
    console.log(`   Stop 1: ${stop1.name}`);
  }
  console.log(`   Destination: ${destination.name}`);
  console.log(`   Driver: ${driver.name}`);
  console.log(`   Vehicle: ${vehicle.name}`);

  // Calculate arrival time (2 hours from now for testing)
  const arrivalTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  // Create shipment
  const { data: shipment, error: shipmentError } = await supabase
    .from('shipments')
    .insert([{
      driver_id: driver.id,
      vehicle_id: vehicle.id,
      origin: origin.id,
      destination: destination.id,
      arrival_time: arrivalTime,
      status: 'In Transit',
      urgency: 'standard',
      total_cost: 1500.00,
      shipping_method: 'truck',
    }])
    .select()
    .single();

  if (shipmentError) {
    console.log('❌ Failed to create shipment:', shipmentError.message);
    return;
  }

  console.log(`\n✅ Created shipment ID: ${shipment.id}`);

  // Create intermediate stop
  if (stop1 && stop1.id !== origin.id && stop1.id !== destination.id) {
    const { error: stopError } = await supabase
      .from('shipment_stops')
      .insert([{
        shipment_id: shipment.id,
        location_id: stop1.id,
        stop_order: 1,
        notes: 'Pickup additional cargo',
      }]);

    if (stopError) {
      console.log('❌ Failed to create stop:', stopError.message);
    } else {
      console.log(`✅ Added intermediate stop: ${stop1.name}`);
    }
  }

  // Create shipment items
  if (freshInventory && freshInventory.length > 0) {
    const items = freshInventory.map((inv, idx) => ({
      shipment_id: shipment.id,
      inventory_item_id: inv.id,
      item_name: inv.item_name,
      quantity: Math.min(10, inv.quantity),
      price_per_unit: inv.price_per_unit,
      total_cost: inv.price_per_unit * Math.min(10, inv.quantity),
      delivery_location_id: destination.id,
    }));

    const { error: itemsError } = await supabase
      .from('shipment_items')
      .insert(items);

    if (itemsError) {
      console.log('❌ Failed to create shipment items:', itemsError.message);
    } else {
      console.log(`✅ Added ${items.length} items to shipment`);
    }
  }

  // Update driver and vehicle status
  await supabase.from('drivers').update({ status: 'Busy' }).eq('id', driver.id);
  await supabase.from('vehicles').update({ status: 'In Transit' }).eq('id', vehicle.id);
  console.log('✅ Updated driver and vehicle status');

  // Final summary
  console.log('\n═══════════════════════════════════════');
  console.log('📊 FINAL SUMMARY');
  console.log('═══════════════════════════════════════');

  const { data: finalShipments } = await supabase
    .from('shipments')
    .select('*')
    .eq('status', 'In Transit');

  const { data: finalStops } = await supabase
    .from('shipment_stops')
    .select('*, locations(name)')
    .eq('shipment_id', shipment.id);

  const { data: finalItems } = await supabase
    .from('shipment_items')
    .select('*')
    .eq('shipment_id', shipment.id);

  console.log(`\n🚚 Active Shipments: ${finalShipments?.length || 0}`);
  console.log(`🛑 Stops for shipment ${shipment.id}: ${finalStops?.length || 0}`);
  finalStops?.forEach(s => {
    console.log(`   - Stop ${s.stop_order}: Location ID ${s.location_id} (${s.locations?.name || 'Unknown'})`);
  });
  console.log(`📦 Items in shipment ${shipment.id}: ${finalItems?.length || 0}`);
  finalItems?.forEach(item => {
    console.log(`   - ${item.item_name}: ${item.quantity} units → Location ${item.delivery_location_id}`);
  });

  console.log('\n✅ Test data creation complete!');
  console.log('🌐 Open the app to see the shipment on the map with intermediate stops.');
}

createTestData().catch(console.error);
