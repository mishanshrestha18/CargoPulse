/**
 * Run database migration to add item_name column to shipments table
 *
 * This script connects to your Supabase database and runs the migration.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

console.log('🔗 Connecting to Supabase...');
console.log('   URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('\n📦 Running migration: add_item_name_to_shipments\n');

    // Step 1: Add column
    console.log('Step 1: Adding item_name column to shipments table...');
    const { error: error1 } = await supabase.rpc('exec_sql', {
      query: 'ALTER TABLE shipments ADD COLUMN IF NOT EXISTS item_name TEXT;'
    });

    // Note: The rpc call might not work with anon key, so we'll try a different approach
    // We'll use the REST API to check if column exists and provide instructions

    console.log('⚠️  Direct DDL operations require admin privileges.');
    console.log('   Checking if we can query the shipments table...\n');

    // Try to query shipments to see if item_name exists
    const { data: testQuery, error: testError } = await supabase
      .from('shipments')
      .select('id, item_name')
      .limit(1);

    if (testError) {
      if (testError.message.includes('item_name')) {
        console.log('✅ Column item_name does not exist yet. Migration needed.\n');
        console.log('📋 Please run this SQL in your Supabase Dashboard:\n');
        console.log('─'.repeat(70));
        console.log(`
-- Add item_name column to shipments table for inventory transfer tracking
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS item_name TEXT;

-- Update existing shipments with item names from inventory table
UPDATE shipments s
SET item_name = i.item_name
FROM inventory i
WHERE s.inventory_item_id = i.id
AND s.item_name IS NULL;

-- Make item_name NOT NULL after backfilling
ALTER TABLE shipments ALTER COLUMN item_name SET NOT NULL;
        `);
        console.log('─'.repeat(70));
        console.log('\n🔗 Direct link to SQL Editor:');
        console.log('   https://supabase.com/dashboard/project/gwkugefxjpocjwaymvjw/sql/new\n');
      } else {
        console.error('❌ Error querying shipments:', testError.message);
      }
    } else {
      console.log('✅ Migration already applied! Column item_name exists.\n');
      console.log('📊 Sample data:', testQuery);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('\n📋 Please run the migration manually in Supabase Dashboard.');
  }
}

runMigration();
