/**
 * Run SQL migration via Supabase REST API
 */

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

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Read migration file
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', 'create_shipment_items_table.sql');
const sql = fs.readFileSync(migrationPath, 'utf-8');

console.log('📋 SQL Migration to run:');
console.log('─'.repeat(80));
console.log(sql);
console.log('─'.repeat(80));
console.log('\n⚠️  Note: This script cannot run DDL statements directly.');
console.log('\n📌 Please run the SQL above in your Supabase Dashboard:');
console.log('   https://supabase.com/dashboard/project/gwkugefxjpocjwaymvjw/sql/new\n');
