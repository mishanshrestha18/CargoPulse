// Execute SQL migration directly using Supabase REST API
const https = require('https');

const supabaseUrl = 'gwkugefxjpocjwaymvjw.supabase.co';
const serviceRoleKey = '***REMOVED-SUPABASE-KEY***';

const sql = `
ALTER TABLE shipment_items ADD COLUMN IF NOT EXISTS delivery_location_id BIGINT;
ALTER TABLE shipment_items ADD CONSTRAINT IF NOT EXISTS shipment_items_delivery_location_fkey FOREIGN KEY (delivery_location_id) REFERENCES locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_shipment_items_delivery_location ON shipment_items(delivery_location_id);
`;

const options = {
  hostname: supabaseUrl,
  port: 443,
  path: '/rest/v1/rpc/exec_sql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`,
    'Prefer': 'return=representation'
  }
};

console.log('🚀 Executing SQL migration...\n');
console.log('SQL to execute:');
console.log(sql);
console.log('\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Migration executed successfully!');
      console.log('Response:', data);
    } else {
      console.error(`❌ Migration failed with status ${res.statusCode}`);
      console.error('Response:', data);
      console.log('\n⚠️  The exec_sql function might not be available.');
      console.log('   Please run the SQL manually in Supabase SQL Editor');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
});

req.write(JSON.stringify({ sql }));
req.end();
