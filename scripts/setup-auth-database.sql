-- =====================================================
-- CargoPulse Authentication Database Setup
-- =====================================================
-- Run this script in your Supabase SQL Editor to set up
-- the complete authentication system with RBAC
-- =====================================================

-- Step 1: Create profiles table
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'dispatcher', 'driver')),
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Enable Row Level Security
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS Policies
-- =====================================================

-- Policy: Users can view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy: Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Users can update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Allow profile creation for new users
DROP POLICY IF EXISTS "Enable insert for authentication" ON profiles;
CREATE POLICY "Enable insert for authentication"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- Step 4: Create trigger function for auto-profile creation
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    'dispatcher', -- Default role for new users
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create trigger
-- =====================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check if profiles table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'profiles'
) AS profiles_table_exists;

-- Check if trigger exists
SELECT EXISTS (
  SELECT FROM pg_trigger
  WHERE tgname = 'on_auth_user_created'
) AS trigger_exists;

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'profiles';

-- List all policies on profiles table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- =====================================================
-- Optional: Create First Admin User
-- =====================================================
-- After you sign up through the app, run this to make yourself an admin:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your.email@example.com';

-- =====================================================
-- Test the Setup
-- =====================================================
-- 1. Sign up a new user through the app at /auth/signup
-- 2. Check if profile was created:
-- SELECT * FROM profiles ORDER BY created_at DESC LIMIT 5;

-- 3. Verify the user has the default 'dispatcher' role
-- 4. Change a user's role:
-- UPDATE profiles SET role = 'admin' WHERE email = 'user@example.com';

-- =====================================================
-- SUCCESS!
-- =====================================================
-- Your authentication database is now set up.
-- Next steps:
-- 1. Go to Supabase Dashboard → Authentication → Settings
-- 2. Configure Site URL and Redirect URLs
-- 3. (Optional) Disable email confirmations for testing
-- 4. Start your Next.js app: npm run dev
-- 5. Navigate to /auth/signup to create your first user
-- =====================================================
