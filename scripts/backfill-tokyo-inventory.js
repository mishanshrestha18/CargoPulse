/**
 * Backfill Tokyo Hub inventory from delivered shipments
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function backfillInventory() {
  console.log('🔄 Backfilling Tokyo Hub inventory from delivered shipments...\n');

  // Get Tokyo Hub location
  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .ilike('name', '%tokyo%');

  if (!locations || locations.length === 0) {
    console.log('❌ Tokyo Hub location not found');
    return;
  }

  const tokyoLocation = locations[0];
  console.log(`✅ Found location: ${tokyoLocation.name} (ID: ${tokyoLocation.id})\n`);

  // Get delivered shipments to Tokyo Hub
  const { data: shipments } = await supabase
    .from('shipments')
    .select('id, item_name, quantity, destination, inventory_item_id')
    .eq('destination', tokyoLocation.id)
    .eq('status', 'Delivered');

  if (!shipments || shipments.length === 0) {
    console.log('No delivered shipments to Tokyo Hub');
    return;
  }

  console.log(`Found ${shipments.length} delivered shipments to Tokyo Hub:\n`);

  // Get original inventory details
  const inventoryIds = [...new Set(shipments.map(s => s.inventory_item_id))];
  const { data: originalInventory } = await supabase
    .from('inventory')
    .select('*')
    .in('id', inventoryIds);

  const inventoryMap = new Map(originalInventory?.map(i => [i.id, i]) || []);

  // Group shipments by item_name
  const itemQuantities = new Map();
  shipments.forEach(s => {
    const itemName = s.item_name;
    const current = itemQuantities.get(itemName) || { quantity: 0, inventory_item_id: s.inventory_item_id };
    current.quantity += s.quantity;
    itemQuantities.set(itemName, current);
  });

  console.log('Items to add to Tokyo Hub:');
  for (const [itemName, data] of itemQuantities) {
    console.log(`  - ${itemName}: ${data.quantity} units`);
  }

  console.log('\n🚀 Creating inventory records...\n');

  // Create inventory records for Tokyo Hub
  for (const [itemName, data] of itemQuantities) {
    const originalItem = inventoryMap.get(data.inventory_item_id);

    // Check if already exists
    const { data: existing } = await supabase
      .from('inventory')
      .select('*')
      .eq('location', tokyoLocation.name)
      .eq('item_name', itemName)
      .maybeSingle();

    if (existing) {
      // Update
      const newQuantity = existing.quantity + data.quantity;
      await supabase
        .from('inventory')
        .update({ quantity: newQuantity })
        .eq('id', existing.id);
      console.log(`  ✅ Updated ${itemName}: ${existing.quantity} -> ${newQuantity}`);
    } else {
      // Insert
      await supabase
        .from('inventory')
        .insert({
          item_name: itemName,
          quantity: data.quantity,
          location: tokyoLocation.name,
          status: 'In Stock',
          price_per_unit: originalItem?.price_per_unit || 0,
          sku: originalItem?.sku || `SKU-${Date.now()}`,
        });
      console.log(`  ✅ Created ${itemName}: ${data.quantity} units`);
    }
  }

  console.log('\n✅ Backfill complete!');
}

backfillInventory();
