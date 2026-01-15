/**
 * Fix inventory for the shipment that was delivered before multi-item fix
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

async function fixDeliveredShipment() {
  console.log('🔍 Checking for the delivered shipment that needs fixing...\n');

  // Find the most recent delivered shipment
  const { data: recentShipment } = await supabase
    .from('shipments')
    .select('id, status, destination')
    .eq('status', 'Delivered')
    .order('arrival_time', { ascending: false })
    .limit(1)
    .single();

  if (!recentShipment) {
    console.log('No delivered shipments found.');
    return;
  }

  console.log('Found delivered shipment:', recentShipment.id);
  console.log();

  // Check if shipment_items exist for this shipment
  const { data: items } = await supabase
    .from('shipment_items')
    .select('*')
    .eq('shipment_id', recentShipment.id);

  if (!items || items.length === 0) {
    console.log('❌ No shipment_items found for this shipment.');
    console.log('   This shipment was likely completed before the multi-item system.');
    return;
  }

  console.log(`✅ Found ${items.length} items for this shipment:`);
  items.forEach(item => {
    console.log(`   - ${item.quantity}x ${item.item_name}`);
  });
  console.log();

  // Get destination info
  const { data: location } = await supabase
    .from('locations')
    .select('*')
    .eq('id', recentShipment.destination)
    .single();

  const destinationName = location?.name;
  console.log('Destination:', destinationName);
  console.log();

  if (!destinationName) {
    console.log('❌ Could not determine destination name');
    return;
  }

  console.log('🔄 Processing inventory transfer now...');
  console.log();

  // Process each item
  for (const item of items) {
    // Check if exists at destination
    const { data: existing } = await supabase
      .from('inventory')
      .select('*')
      .eq('location', destinationName)
      .eq('item_name', item.item_name)
      .maybeSingle();

    if (existing) {
      // Update
      const newQty = existing.quantity + item.quantity;
      await supabase
        .from('inventory')
        .update({ quantity: newQty })
        .eq('id', existing.id);
      console.log(`✅ Updated: ${item.item_name} at ${destinationName} (${existing.quantity} -> ${newQty})`);
    } else {
      // Insert
      const { data: orig } = await supabase
        .from('inventory')
        .select('price_per_unit, sku')
        .eq('id', item.inventory_item_id)
        .single();

      await supabase
        .from('inventory')
        .insert({
          item_name: item.item_name,
          quantity: item.quantity,
          location: destinationName,
          status: 'In Stock',
          price_per_unit: orig?.price_per_unit || item.price_per_unit,
          sku: orig?.sku || `SKU-${Date.now()}`,
        });
      console.log(`✅ Created: ${item.item_name} at ${destinationName} (${item.quantity} units)`);
    }
  }

  console.log();
  console.log('🎉 Inventory transfer complete!');
  console.log('   Check your Warehouse page - the items should now appear at', destinationName);
}

fixDeliveredShipment();
