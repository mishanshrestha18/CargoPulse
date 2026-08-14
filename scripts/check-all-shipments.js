// Check ALL shipments to understand what happened
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('\u274c Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkAllShipments() {
  console.log('🔍 Checking ALL shipments...\n');

  try {
    // Get all shipments with their items
    const { data: allShipments } = await supabase
      .from('shipments')
      .select(`
        *,
        shipment_items(
          *,
          locations:delivery_location_id(name)
        ),
        origin:origin_location_id(name),
        destination:destination_location_id(name)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    console.log(`📦 Total Shipments Found: ${allShipments?.length || 0}\n`);

    allShipments?.forEach((shipment, idx) => {
      const createdDate = new Date(shipment.created_at).toLocaleString();
      console.log(`[${idx + 1}] Shipment #${shipment.id} - ${shipment.status}`);
      console.log(`    Created: ${createdDate}`);
      console.log(`    Route: ${shipment.origin?.name} → ${shipment.destination?.name}`);

      if (shipment.shipment_items && shipment.shipment_items.length > 0) {
        console.log('    Items:');
        shipment.shipment_items.forEach(item => {
          const destName = item.locations?.name || item.delivery_location_id || 'No destination';
          console.log(`      - ${item.quantity}x ${item.item_name} → ${destName}`);
        });
      } else {
        console.log('    Items: None (legacy shipment)');
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAllShipments();
