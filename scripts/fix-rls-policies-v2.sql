-- Fix Infinite Recursion in RLS Policies
-- This is the CORRECT version without recursion issues

-- Step 1: Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authentication" ON profiles;
DROP POLICY IF EXISTS "Enable insert for new users" ON profiles;

-- Step 2: Create simple, non-recursive policy for SELECT
-- Allow any authenticated user to read any profile
-- (We'll handle role-based restrictions in the application layer if needed)
CREATE POLICY "Allow authenticated users to read profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Step 3: Allow users to insert their own profile (for signups)
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Step 4: Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Step 5: Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 6: Grant permissions
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

-- Step 7: Verify policies (should show 3 policies now)
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Step 8: Test - this should now work!
SELECT id, email, role, full_name FROM profiles WHERE id = auth.uid();
