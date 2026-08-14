// Fix inventory bug - remove duplicate car parts from Tokyo and add to London
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('\u274c Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixInventory() {
  console.log('🔍 Checking inventory state...\n');

  try {
    // 1. Check Car Engine Parts in all locations
    const { data: allCarParts } = await supabase
      .from('inventory')
      .select('*')
      .ilike('item_name', '%car%engine%');

    console.log('📊 Current Car Engine Parts:');
    allCarParts?.forEach(item => {
      console.log(`   ${item.location}: ${item.quantity}x ${item.item_name}`);
    });
    console.log('');

    // 2. Find Tokyo Car Engine Parts
    const tokyoCarParts = allCarParts?.find(item =>
      item.location === 'Tokyo' && item.item_name.toLowerCase().includes('car') && item.item_name.toLowerCase().includes('engine')
    );

    if (!tokyoCarParts) {
      console.log('❌ No Car Engine Parts found in Tokyo');
      return;
    }

    console.log(`📦 Tokyo has ${tokyoCarParts.quantity} car engine parts`);

    // The bug: Tokyo should have 1, but has 2 (both items went there)
    if (tokyoCarParts.quantity > 1) {
      console.log('🔧 Fixing: Removing 1 from Tokyo and adding to London...\n');

      // Reduce Tokyo quantity by 1
      await supabase
        .from('inventory')
        .update({ quantity: tokyoCarParts.quantity - 1 })
        .eq('id', tokyoCarParts.id);

      console.log('✅ Reduced Tokyo inventory by 1');

      // Check if London has Car Engine Parts
      const { data: londonCarParts } = await supabase
        .from('inventory')
        .select('*')
        .eq('location', 'London')
        .ilike('item_name', '%car%engine%')
        .maybeSingle();

      if (londonCarParts) {
        // London already has some, increment
        await supabase
          .from('inventory')
          .update({
            quantity: londonCarParts.quantity + 1,
            status: 'In Stock'
          })
          .eq('id', londonCarParts.id);
        console.log('✅ Added 1 to existing London inventory');
      } else {
        // Create new entry for London
        await supabase
          .from('inventory')
          .insert({
            item_name: tokyoCarParts.item_name,
            quantity: 1,
            location: 'London',
            status: 'In Stock',
            price_per_unit: tokyoCarParts.price_per_unit,
            sku: tokyoCarParts.sku,
          });
        console.log('✅ Created new Car Engine Parts entry in London');
      }
    } else {
      console.log('✅ Tokyo inventory looks correct (only 1 item)');
    }

    // 3. Verify final state
    console.log('\n📊 Final Car Engine Parts:');
    const { data: finalCarParts } = await supabase
      .from('inventory')
      .select('*')
      .ilike('item_name', '%car%engine%');

    finalCarParts?.forEach(item => {
      console.log(`   ${item.location}: ${item.quantity}x ${item.item_name}`);
    });

    console.log('\n✅ Inventory fix completed!');

  } catch (error) {
    console.error('❌ Error during fix:', error);
  }
}

fixInventory();
