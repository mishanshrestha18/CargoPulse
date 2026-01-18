-- Create notifications table for real-time notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Optional: for user-specific notifications
  type TEXT NOT NULL CHECK (type IN ('dispatch', 'arrival', 'cancel', 'alert', 'maintenance', 'info')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb -- Extra data like shipment_id, vehicle_id, etc.
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Enable Row Level Security (optional - disable if you want all users to see all notifications)
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy to allow all authenticated users to read notifications
-- CREATE POLICY "Users can view notifications" ON notifications
--   FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Policy to allow all authenticated users to update their own notifications
-- CREATE POLICY "Users can update their notifications" ON notifications
--   FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- Enable Realtime for the notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Insert some test notifications
INSERT INTO notifications (type, title, message, metadata) VALUES
  ('dispatch', 'Shipment Dispatched', 'Order #1234 has been dispatched from JFK Airport to Chicago Hub', '{"shipment_id": 1}'),
  ('arrival', 'Delivery Complete', 'Order #1230 has been delivered successfully', '{"shipment_id": 2}'),
  ('alert', 'Low Inventory Alert', 'Electronics items are running low (15 units remaining)', '{"inventory_id": 5}'),
  ('maintenance', 'Vehicle Maintenance', 'Truck A-001 scheduled for maintenance tomorrow', '{"vehicle_id": 1}'),
  ('info', 'System Update', 'New features have been added to the dashboard', '{}');

-- Verify the table
SELECT * FROM notifications ORDER BY created_at DESC;
