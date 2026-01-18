-- Create expenses table for expense management
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT NOT NULL,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);

-- Enable RLS (optional - disable if you want simpler access)
-- ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own expenses, admins can view all
-- CREATE POLICY "Users can view own expenses" ON expenses
--   FOR SELECT USING (auth.uid() = user_id OR EXISTS (
--     SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
--   ));

-- Policy: Users can insert their own expenses
-- CREATE POLICY "Users can insert own expenses" ON expenses
--   FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Only admins can update expenses (for approval/rejection)
-- CREATE POLICY "Admins can update expenses" ON expenses
--   FOR UPDATE USING (EXISTS (
--     SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
--   ));

-- Verify the table
SELECT * FROM expenses LIMIT 5;
