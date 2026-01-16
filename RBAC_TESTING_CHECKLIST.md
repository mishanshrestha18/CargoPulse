# RBAC System Testing Checklist

## Prerequisites ✓

- [x] AuthContext.tsx created with profile fetching
- [x] RoleGuard.tsx created for page protection
- [x] Sidebar.tsx updated with role-based navigation
- [x] Unauthorized page created at `/unauthorized`
- [x] LayoutClient.tsx updated with AuthProvider
- [x] Sample data SQL script created
- [x] RBAC_SETUP.md documentation created

## Database Setup

### Step 1: Create Profiles Table

Run this in your Supabase SQL Editor:

```sql
-- Create profiles table
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

-- Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    'dispatcher', -- Default role
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Step 2: Create Test Users

Sign up test users through your app's authentication UI, or use Supabase dashboard to create users with these emails:

- admin@cargopulse.com
- mike.johnson@cargopulse.com
- james.wilson@cargopulse.com

### Step 3: Assign Roles

Run the sample data script:

```bash
# From project root
cat scripts/seed-profiles.sql | pbcopy
# Then paste into Supabase SQL Editor
```

Or manually assign roles:

```sql
-- Make a user an admin
UPDATE profiles SET role = 'admin', full_name = 'Admin User'
WHERE email = 'admin@cargopulse.com';

-- Make a user a dispatcher
UPDATE profiles SET role = 'dispatcher', full_name = 'Dispatcher User'
WHERE email = 'mike.johnson@cargopulse.com';

-- Make a user a driver
UPDATE profiles SET role = 'driver', full_name = 'Driver User'
WHERE email = 'james.wilson@cargopulse.com';
```

## Testing Scenarios

### Test 1: Admin User Access

**Login as:** admin@cargopulse.com

**Expected Behavior:**
- ✅ Should see ALL navigation items:
  - Dashboard
  - Analytics
  - Fleet
  - Airplanes
  - Drivers
  - Warehouse
  - Maintenance
- ✅ Should NOT see "My Tasks"
- ✅ Profile section shows name and "admin" role
- ✅ Can access `/analytics` directly
- ✅ Can access all other pages

**Test Steps:**
1. Sign in with admin credentials
2. Check sidebar navigation items
3. Navigate to Analytics page
4. Navigate to Fleet page
5. Navigate to Warehouse page
6. Verify profile section shows "admin" role

### Test 2: Dispatcher User Access

**Login as:** mike.johnson@cargopulse.com

**Expected Behavior:**
- ✅ Should see:
  - Dashboard
  - Fleet
  - Airplanes
  - Drivers
  - Warehouse
  - Maintenance
- ❌ Should NOT see "Analytics"
- ❌ Should NOT see "My Tasks"
- ✅ Profile section shows name and "dispatcher" role
- ❌ Redirected to `/unauthorized` if accessing `/analytics`

**Test Steps:**
1. Sign in with dispatcher credentials
2. Check sidebar navigation items (no Analytics)
3. Navigate to Fleet page (should work)
4. Navigate to Warehouse page (should work)
5. Try accessing `/analytics` directly (should redirect)
6. Verify profile section shows "dispatcher" role

### Test 3: Driver User Access

**Login as:** james.wilson@cargopulse.com

**Expected Behavior:**
- ✅ Should see ONLY:
  - Dashboard
  - My Tasks
- ❌ Should NOT see any management pages
- ✅ Profile section shows name and "driver" role
- ❌ Redirected to `/unauthorized` for restricted pages

**Test Steps:**
1. Sign in with driver credentials
2. Check sidebar navigation items (only Dashboard + My Tasks)
3. Try accessing `/fleet` directly (should redirect)
4. Try accessing `/analytics` directly (should redirect)
5. Navigate to My Tasks page (should work)
6. Verify profile section shows "driver" role

### Test 4: Unauthorized Page

**Test Steps:**
1. Sign in as driver
2. Navigate to `/fleet` or `/analytics` directly
3. Should see unauthorized page with:
   - Shield icon
   - "Access Denied" message
   - Current role displayed
   - "Go Back" button
   - "Dashboard" button

### Test 5: Sign Out Functionality

**Test Steps:**
1. Sign in with any role
2. Click "Sign Out" button in sidebar
3. Should show confirmation dialog
4. After confirming, should be signed out
5. Should be redirected to login page

### Test 6: Profile Refresh

**Test Steps:**
1. Sign in as a user
2. Change their role in Supabase database
3. Use `refreshProfile()` function or sign out/in
4. Verify navigation items update

## Verification Queries

Run these in Supabase SQL Editor to verify setup:

```sql
-- Check all profiles and their roles
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

-- Check for users without roles
SELECT
  email,
  created_at
FROM profiles
WHERE role IS NULL;
```

## Troubleshooting

### Issue: "useAuth must be used within an AuthProvider"

**Solution:** AuthProvider is already added to LayoutClient.tsx. Make sure you're importing from the correct path.

### Issue: Navigation items not filtering

**Solution:**
1. Check browser console for errors
2. Verify AuthProvider wraps the app
3. Check that profiles table has correct role values
4. Sign out and sign back in

### Issue: Profile not loading

**Solution:**
1. Check if profiles table exists
2. Verify trigger is enabled
3. Check browser console for Supabase errors
4. Verify RLS policies allow user to read their profile

### Issue: Always redirected to unauthorized

**Solution:**
1. Check user's role in profiles table
2. Verify email matches between auth.users and profiles
3. Clear browser localStorage and cookies
4. Sign out and sign back in

## Security Checklist

- [ ] RLS policies enabled on profiles table
- [ ] Auth trigger creates profiles automatically
- [ ] Default role is set appropriately (dispatcher recommended)
- [ ] Admin role assigned only to trusted users
- [ ] Client-side protection matches server-side RLS
- [ ] Environment variables secured
- [ ] HTTPS enabled in production

## Next Steps

After RBAC is tested and working:

1. **Implement Authentication Pages**
   - Sign up page
   - Sign in page
   - Password reset page
   - Protected route wrapper

2. **Add Role Management UI** (Admin only)
   - View all users
   - Assign/change roles
   - Audit log of role changes

3. **Enhance Security**
   - Add server-side API route protection
   - Implement JWT validation
   - Add rate limiting
   - Enable MFA for admins

4. **Add Audit Logging**
   - Track who accessed what
   - Log role changes
   - Monitor failed access attempts

## Test User Credentials Reference

| Role | Email | Full Name | Access Level |
|------|-------|-----------|--------------|
| Admin | admin@cargopulse.com | John Administrator | Full access |
| Admin | sarah.chen@cargopulse.com | Sarah Chen | Full access |
| Dispatcher | mike.johnson@cargopulse.com | Mike Johnson | Fleet + Warehouse |
| Dispatcher | emily.rodriguez@cargopulse.com | Emily Rodriguez | Fleet + Warehouse |
| Driver | james.wilson@cargopulse.com | James Wilson | Dashboard + My Tasks |
| Driver | maria.garcia@cargopulse.com | Maria Garcia | Dashboard + My Tasks |

All passwords need to be set during user signup or via password reset flow.

## Status: ✅ READY FOR TESTING

All components are implemented. Follow this checklist to set up and test the RBAC system.
