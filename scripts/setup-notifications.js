// Script to set up the notifications table in Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupNotifications() {
  console.log('🔔 Setting up notifications table...\n');

  // Check if table exists by trying to query it
  const { data: existingData, error: checkError } = await supabase
    .from('notifications')
    .select('id')
    .limit(1);

  if (checkError && checkError.code === '42P01') {
    console.log('❌ Table does not exist. Please run the SQL script in Supabase SQL Editor:');
    console.log('   scripts/create-notifications-table.sql');
    console.log('\n   Or run these commands in Supabase SQL Editor:\n');
    console.log(`
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('dispatch', 'arrival', 'cancel', 'alert', 'maintenance', 'info')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    `);
    return;
  }

  if (checkError) {
    console.error('Error checking table:', checkError.message);
    return;
  }

  console.log('✅ Notifications table exists!\n');

  // Check current notifications
  const { data: notifications, error: fetchError } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (fetchError) {
    console.error('Error fetching notifications:', fetchError.message);
    return;
  }

  console.log(`📊 Current notifications: ${notifications?.length || 0}\n`);

  if (notifications && notifications.length > 0) {
    notifications.forEach((n, i) => {
      console.log(`  ${i + 1}. [${n.type.toUpperCase()}] ${n.title}`);
      console.log(`     ${n.message}`);
      console.log(`     Read: ${n.is_read}, Created: ${new Date(n.created_at).toLocaleString()}`);
      console.log('');
    });
  }

  // Ask if user wants to add test notifications
  console.log('📝 Adding sample notifications...\n');

  const testNotifications = [
    {
      type: 'dispatch',
      title: 'Shipment Dispatched',
      message: 'Order #1234 has been dispatched from JFK Airport to Chicago Hub',
      is_read: false,
      metadata: { shipment_id: 1 },
    },
    {
      type: 'arrival',
      title: 'Delivery Complete',
      message: 'Order #1230 has been delivered successfully to the destination',
      is_read: false,
      metadata: { shipment_id: 2 },
    },
    {
      type: 'alert',
      title: 'Low Inventory Alert',
      message: 'Electronics items are running low (15 units remaining)',
      is_read: false,
      metadata: { inventory_id: 5 },
    },
    {
      type: 'maintenance',
      title: 'Vehicle Maintenance Due',
      message: 'Truck A-001 is scheduled for maintenance tomorrow at 9:00 AM',
      is_read: false,
      metadata: { vehicle_id: 1 },
    },
    {
      type: 'info',
      title: 'System Update',
      message: 'Real-time notifications have been enabled for your dashboard',
      is_read: false,
      metadata: {},
    },
  ];

  for (const notif of testNotifications) {
    const { error } = await supabase.from('notifications').insert([notif]);
    if (error) {
      console.log(`  ❌ Failed to add: ${notif.title} - ${error.message}`);
    } else {
      console.log(`  ✅ Added: [${notif.type.toUpperCase()}] ${notif.title}`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('🎉 Notifications setup complete!');
  console.log('═══════════════════════════════════════');
  console.log('\nReal-time notifications are now ready.');
  console.log('Open your app to see the NotificationBell in action!');
}

setupNotifications().catch(console.error);
