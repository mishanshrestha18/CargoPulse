/**
 * Run database migration to add item_name column to shipments table
 *
 * Usage: npx tsx scripts/run-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('📦 Reading migration file...');
    const migrationPath = path.join(__dirname, '..', 'add_item_name_to_shipments.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Running migration...\n');
    console.log('SQL to execute:');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    console.log();

    // Split SQL by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);

      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        // If RPC doesn't exist, try direct execution (this might not work with ALTER TABLE)
        console.warn('⚠️  RPC method not available. You need to run this migration manually in Supabase Dashboard.');
        console.log('\n📋 Instructions:');
        console.log('1. Go to your Supabase Dashboard: https://supabase.com/dashboard');
        console.log('2. Select your project');
        console.log('3. Navigate to SQL Editor');
        console.log('4. Copy and paste the contents of add_item_name_to_shipments.sql');
        console.log('5. Click "Run" to execute\n');
        process.exit(1);
      }

      console.log(`✅ Statement ${i + 1} executed successfully`);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Verifying migration...');

    // Verify the column exists
    const { data, error } = await supabase
      .from('shipments')
      .select('item_name')
      .limit(1);

    if (error) {
      console.error('❌ Verification failed:', error.message);
      console.log('\nThe migration may not have been applied correctly.');
      console.log('Please run it manually in the Supabase Dashboard.');
    } else {
      console.log('✅ Verification successful! The item_name column exists.');
    }

  } catch (err) {
    console.error('❌ Migration failed:', err);
    console.log('\n📋 Please run the migration manually:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Copy contents of add_item_name_to_shipments.sql');
    console.log('3. Execute the SQL\n');
    process.exit(1);
  }
}

runMigration();
