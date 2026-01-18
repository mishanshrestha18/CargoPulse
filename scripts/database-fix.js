// Database cleanup and fix script
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gwkugefxjpocjwaymvjw.supabase.co';
const serviceRoleKey = '***REMOVED-SUPABASE-KEY***';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function cleanupDatabase() {
  console.log('🔍 Checking database state...\n');

  try {
    // 1. Check current state
    const { data: activeShipments } = await supabase
      .from('shipments')
      .select('*')
      .eq('status', 'In Transit');

    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('*');

    const { data: drivers } = await supabase
      .from('drivers')
      .select('*');

    console.log('📊 Current State:');
    console.log(`   Active Shipments: ${activeShipments?.length || 0}`);
    console.log(`   Vehicles In Transit: ${vehicles?.filter(v => v.status === 'In Transit').length || 0}`);
    console.log(`   Drivers In Transit: ${drivers?.filter(d => d.status === 'In Transit').length || 0}`);
    console.log(`   Total Vehicles: ${vehicles?.length || 0}`);
    console.log(`   Total Drivers: ${drivers?.length || 0}\n`);

    // 2. Reset all vehicles to Idle
    console.log('🚛 Resetting all vehicles to Idle...');
    const { error: vehicleError } = await supabase
      .from('vehicles')
      .update({ status: 'Idle' })
      .neq('status', 'Maintenance'); // Keep maintenance status

    if (vehicleError) {
      console.error('❌ Error updating vehicles:', vehicleError);
    } else {
      console.log('✅ All vehicles reset to Idle\n');
    }

    // 3. Reset all drivers to Idle
    console.log('👨‍✈️ Resetting all drivers to Idle...');
    const { error: driverError } = await supabase
      .from('drivers')
      .update({ status: 'Idle' })
      .eq('status', 'In Transit');

    if (driverError) {
      console.error('❌ Error updating drivers:', driverError);
    } else {
      console.log('✅ All drivers reset to Idle\n');
    }

    // 4. Cancel all active shipments
    console.log('📦 Cancelling all active shipments...');
    const { error: shipmentError } = await supabase
      .from('shipments')
      .update({ status: 'Cancelled' })
      .in('status', ['In Transit', 'Pending']);

    if (shipmentError) {
      console.error('❌ Error updating shipments:', shipmentError);
    } else {
      console.log('✅ All active shipments cancelled\n');
    }

    // 5. Verify final state
    const { data: finalShipments } = await supabase
      .from('shipments')
      .select('*')
      .eq('status', 'In Transit');

    const { data: finalVehicles } = await supabase
      .from('vehicles')
      .select('*');

    const { data: finalDrivers } = await supabase
      .from('drivers')
      .select('*');

    console.log('📊 Final State:');
    console.log(`   Active Shipments: ${finalShipments?.length || 0}`);
    console.log(`   Vehicles In Transit: ${finalVehicles?.filter(v => v.status === 'In Transit').length || 0}`);
    console.log(`   Vehicles Idle: ${finalVehicles?.filter(v => v.status === 'Idle').length || 0}`);
    console.log(`   Drivers In Transit: ${finalDrivers?.filter(d => d.status === 'In Transit').length || 0}`);
    console.log(`   Drivers Idle: ${finalDrivers?.filter(d => d.status === 'Idle').length || 0}\n`);

    console.log('✅ Database cleanup completed successfully!');
    console.log('👉 Now refresh your browser to see the fixed dashboard.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

cleanupDatabase();
