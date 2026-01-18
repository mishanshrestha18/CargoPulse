// Check recent shipments to see what happened
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gwkugefxjpocjwaymvjw.supabase.co';
const serviceRoleKey = '***REMOVED-SUPABASE-KEY***';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkShipments() {
  console.log('🔍 Checking recent shipments...\n');

  try {
    // Get the most recent delivered shipment
    const { data: recentShipments } = await supabase
      .from('shipments')
      .select('*, shipment_items(*, locations:delivery_location_id(name))')
      .eq('status', 'Delivered')
      .order('created_at', { ascending: false })
      .limit(3);

    console.log('📦 Recent Delivered Shipments:\n');
    recentShipments?.forEach((shipment, idx) => {
      console.log(`Shipment #${shipment.id} (${new Date(shipment.created_at).toLocaleString()}):`);
      console.log(`  Status: ${shipment.status}`);

      if (shipment.shipment_items && shipment.shipment_items.length > 0) {
        console.log('  Items:');
        shipment.shipment_items.forEach(item => {
          const destName = item.locations?.name || 'Unknown';
          console.log(`    - ${item.quantity}x ${item.item_name} → ${destName}`);
        });
      }
      console.log('');
    });

    // Check inventory changes in London and Tokyo Hub
    console.log('📊 Current Inventory in London and Tokyo Hub:');
    const { data: inventory } = await supabase
      .from('inventory')
      .select('*')
      .in('location', ['London', 'Tokyo Hub'])
      .order('location');

    const londonItems = inventory?.filter(i => i.location === 'London') || [];
    const tokyoItems = inventory?.filter(i => i.location === 'Tokyo Hub') || [];

    console.log('\n  London:');
    londonItems.forEach(item => {
      console.log(`    ${item.quantity}x ${item.item_name}`);
    });

    console.log('\n  Tokyo Hub:');
    tokyoItems.forEach(item => {
      console.log(`    ${item.quantity}x ${item.item_name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkShipments();
