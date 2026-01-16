-- =====================================================
-- CargoPulse Profiles Table - Sample Data
-- =====================================================
-- This script creates sample profiles for testing RBAC
-- Run this AFTER creating the profiles table
-- =====================================================

-- First, create the profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'dispatcher', 'driver')),
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- SAMPLE DATA
-- =====================================================
-- Note: You'll need to replace the UUIDs with actual user IDs from auth.users
-- after users sign up through your application
-- =====================================================

-- Method 1: If you have existing users in auth.users, update their profiles
-- Run this query first to see your existing users:
-- SELECT id, email FROM auth.users;

-- Then use these UPDATE statements (replace UUIDs with actual user IDs):

-- ADMIN USERS
UPDATE profiles SET
  role = 'admin',
  full_name = 'John Administrator',
  updated_at = NOW()
WHERE email = 'admin@cargopulse.com';

UPDATE profiles SET
  role = 'admin',
  full_name = 'Sarah Chen',
  updated_at = NOW()
WHERE email = 'sarah.chen@cargopulse.com';

-- DISPATCHER USERS
UPDATE profiles SET
  role = 'dispatcher',
  full_name = 'Mike Johnson',
  updated_at = NOW()
WHERE email = 'mike.johnson@cargopulse.com';

UPDATE profiles SET
  role = 'dispatcher',
  full_name = 'Emily Rodriguez',
  updated_at = NOW()
WHERE email = 'emily.rodriguez@cargopulse.com';

UPDATE profiles SET
  role = 'dispatcher',
  full_name = 'David Park',
  updated_at = NOW()
WHERE email = 'david.park@cargopulse.com';

UPDATE profiles SET
  role = 'dispatcher',
  full_name = 'Lisa Wong',
  updated_at = NOW()
WHERE email = 'lisa.wong@cargopulse.com';

-- DRIVER USERS
UPDATE profiles SET
  role = 'driver',
  full_name = 'James Wilson',
  updated_at = NOW()
WHERE email = 'james.wilson@cargopulse.com';

UPDATE profiles SET
  role = 'driver',
  full_name = 'Maria Garcia',
  updated_at = NOW()
WHERE email = 'maria.garcia@cargopulse.com';

UPDATE profiles SET
  role = 'driver',
  full_name = 'Robert Taylor',
  updated_at = NOW()
WHERE email = 'robert.taylor@cargopulse.com';

UPDATE profiles SET
  role = 'driver',
  full_name = 'Jennifer Lee',
  updated_at = NOW()
WHERE email = 'jennifer.lee@cargopulse.com';

UPDATE profiles SET
  role = 'driver',
  full_name = 'Michael Brown',
  updated_at = NOW()
WHERE email = 'michael.brown@cargopulse.com';

UPDATE profiles SET
  role = 'driver',
  full_name = 'Ashley Martinez',
  updated_at = NOW()
WHERE email = 'ashley.martinez@cargopulse.com';

UPDATE profiles SET
  role = 'driver',
  full_name = 'Christopher Davis',
  updated_at = NOW()
WHERE email = 'christopher.davis@cargopulse.com';

UPDATE profiles SET
  role = 'driver',
  full_name = 'Jessica Anderson',
  updated_at = NOW()
WHERE email = 'jessica.anderson@cargopulse.com';

-- =====================================================
-- Method 2: Direct INSERT (if users already exist in auth.users)
-- =====================================================
-- WARNING: Only use this if you have actual user IDs from auth.users
-- Replace 'USER_ID_HERE' with actual UUIDs from auth.users table

/*
-- EXAMPLE: Direct inserts with actual user IDs
INSERT INTO profiles (id, email, role, full_name) VALUES
  ('USER_ID_1', 'admin@cargopulse.com', 'admin', 'John Administrator'),
  ('USER_ID_2', 'sarah.chen@cargopulse.com', 'admin', 'Sarah Chen'),
  ('USER_ID_3', 'mike.johnson@cargopulse.com', 'dispatcher', 'Mike Johnson'),
  ('USER_ID_4', 'emily.rodriguez@cargopulse.com', 'dispatcher', 'Emily Rodriguez'),
  ('USER_ID_5', 'james.wilson@cargopulse.com', 'driver', 'James Wilson'),
  ('USER_ID_6', 'maria.garcia@cargopulse.com', 'driver', 'Maria Garcia')
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  updated_at = NOW();
*/

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- View all profiles with their roles
SELECT
  full_name,
  email,
  role,
  created_at
FROM profiles
ORDER BY
  CASE role
    WHEN 'admin' THEN 1
    WHEN 'dispatcher' THEN 2
    WHEN 'driver' THEN 3
  END,
  full_name;

-- Count users by role
SELECT
  role,
  COUNT(*) as user_count
FROM profiles
GROUP BY role
ORDER BY
  CASE role
    WHEN 'admin' THEN 1
    WHEN 'dispatcher' THEN 2
    WHEN 'driver' THEN 3
  END;

-- =====================================================
-- TESTING CREDENTIALS
-- =====================================================
-- After running this script, you can sign in with:
--
-- ADMIN ACCESS:
-- Email: admin@cargopulse.com
-- (You'll need to set password during signup or password reset)
--
-- DISPATCHER ACCESS:
-- Email: mike.johnson@cargopulse.com
--
-- DRIVER ACCESS:
-- Email: james.wilson@cargopulse.com
--
-- =====================================================

-- =====================================================
-- QUICK ROLE ASSIGNMENT (for existing users)
-- =====================================================
-- If you already have users signed up, use these quick commands:

-- Make a user an admin:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your.email@example.com';

-- Make a user a dispatcher:
-- UPDATE profiles SET role = 'dispatcher' WHERE email = 'your.email@example.com';

-- Make a user a driver:
-- UPDATE profiles SET role = 'driver' WHERE email = 'your.email@example.com';
