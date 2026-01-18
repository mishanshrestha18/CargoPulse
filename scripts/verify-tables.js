// Script to verify profiles, shipment_items, and shipment_stops tables
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyTables() {
  console.log('🔍 Verifying database tables...\n');

  // 1. Check profiles table
  console.log('═══════════════════════════════════════');
  console.log('📋 PROFILES TABLE');
  console.log('═══════════════════════════════════════');
  try {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);

    if (profilesError) {
      console.log('❌ Error:', profilesError.message);
      if (profilesError.code === '42P01') {
        console.log('   Table does not exist!');
      }
    } else {
      console.log('✅ Table exists');
      console.log(`   Records found: ${profiles?.length || 0}`);
      if (profiles && profiles.length > 0) {
        console.log('   Columns:', Object.keys(profiles[0]).join(', '));
        console.log('   Sample data:');
        profiles.forEach((p, i) => {
          console.log(`   [${i + 1}] id: ${p.id}, role: ${p.role}, email: ${p.email || 'N/A'}`);
        });
      }
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }

  // 2. Check shipment_items table
  console.log('\n═══════════════════════════════════════');
  console.log('📦 SHIPMENT_ITEMS TABLE');
  console.log('═══════════════════════════════════════');
  try {
    const { data: items, error: itemsError } = await supabase
      .from('shipment_items')
      .select('*')
      .limit(5);

    if (itemsError) {
      console.log('❌ Error:', itemsError.message);
      if (itemsError.code === '42P01') {
        console.log('   Table does not exist!');
      }
    } else {
      console.log('✅ Table exists');
      console.log(`   Records found: ${items?.length || 0}`);
      if (items && items.length > 0) {
        console.log('   Columns:', Object.keys(items[0]).join(', '));
        console.log('   Sample data:');
        items.forEach((item, i) => {
          console.log(`   [${i + 1}] id: ${item.id}, shipment_id: ${item.shipment_id}, item_name: ${item.item_name}, qty: ${item.quantity}, delivery_location_id: ${item.delivery_location_id || 'NULL'}`);
        });
      }
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }

  // 3. Check shipment_stops table
  console.log('\n═══════════════════════════════════════');
  console.log('🛑 SHIPMENT_STOPS TABLE');
  console.log('═══════════════════════════════════════');
  try {
    const { data: stops, error: stopsError } = await supabase
      .from('shipment_stops')
      .select('*')
      .limit(5);

    if (stopsError) {
      console.log('❌ Error:', stopsError.message);
      if (stopsError.code === '42P01') {
        console.log('   Table does not exist!');
      }
    } else {
      console.log('✅ Table exists');
      console.log(`   Records found: ${stops?.length || 0}`);
      if (stops && stops.length > 0) {
        console.log('   Columns:', Object.keys(stops[0]).join(', '));
        console.log('   Sample data:');
        stops.forEach((stop, i) => {
          console.log(`   [${i + 1}] id: ${stop.id}, shipment_id: ${stop.shipment_id}, location_id: ${stop.location_id}, stop_order: ${stop.stop_order}`);
        });
      }
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }

  // 4. Check related tables for context
  console.log('\n═══════════════════════════════════════');
  console.log('📊 RELATED TABLES SUMMARY');
  console.log('═══════════════════════════════════════');

  const tables = ['shipments', 'locations', 'inventory', 'vehicles', 'drivers'];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        // Get actual count
        const { data: allData } = await supabase.from(table).select('id');
        console.log(`✅ ${table}: ${allData?.length || 0} records`);
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`);
    }
  }

  // 5. Check for any "In Transit" shipments
  console.log('\n═══════════════════════════════════════');
  console.log('🚚 ACTIVE SHIPMENTS (In Transit)');
  console.log('═══════════════════════════════════════');
  try {
    const { data: activeShipments, error } = await supabase
      .from('shipments')
      .select('id, origin, destination, status, shipping_method, urgency')
      .eq('status', 'In Transit');

    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log(`Found ${activeShipments?.length || 0} active shipments`);
      if (activeShipments && activeShipments.length > 0) {
        activeShipments.forEach((s, i) => {
          console.log(`   [${i + 1}] ID: ${s.id}, ${s.origin} → ${s.destination}, method: ${s.shipping_method}, urgency: ${s.urgency}`);
        });
      }
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }

  console.log('\n✅ Verification complete!\n');
}

verifyTables().catch(console.error);
