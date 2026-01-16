# Authentication Setup Guide

## Overview

CargoPulse now includes a complete authentication system with user signup, login, password reset, and automatic profile creation with role-based access control (RBAC).

## Features

- ✅ User Signup with automatic profile creation
- ✅ User Login with email/password
- ✅ Password Reset functionality
- ✅ Protected routes with middleware
- ✅ Automatic role assignment (default: dispatcher)
- ✅ Integration with RBAC system
- ✅ Dark mode support
- ✅ Responsive design

## Database Setup

### Step 1: Create the Profiles Table

Run this SQL in your Supabase SQL Editor:

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

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

### Step 2: Create the Auto-Profile Trigger

This trigger automatically creates a profile when a user signs up:

```sql
-- Create trigger function
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

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Step 3: Configure Supabase Auth Settings

In your Supabase Dashboard, go to **Authentication → Settings**:

1. **Enable Email Auth**: Make sure Email provider is enabled
2. **Disable Email Confirmations** (Optional for testing):
   - Set "Enable email confirmations" to OFF
3. **Site URL**: Set to your app URL (e.g., `http://localhost:3000`)
4. **Redirect URLs**: Add your app URLs:
   - `http://localhost:3000/**`
   - Your production URL

## File Structure

```
src/
├── app/
│   ├── auth/
│   │   ├── layout.tsx          # Auth pages layout
│   │   ├── login/
│   │   │   └── page.tsx        # Login page
│   │   ├── signup/
│   │   │   └── page.tsx        # Signup page
│   │   └── forgot-password/
│   │       └── page.tsx        # Password reset page
│   └── unauthorized/
│       └── page.tsx            # Access denied page
├── contexts/
│   └── AuthContext.tsx         # Auth state management
├── components/
│   └── RoleGuard.tsx           # Role-based protection
└── middleware.ts               # Route protection
```

## Authentication Flow

### 1. User Signup

**URL**: `/auth/signup`

**Process**:
1. User fills out signup form (name, email, password)
2. Password validation (min 6 characters)
3. Supabase creates auth user
4. Database trigger automatically creates profile with default "dispatcher" role
5. Success message shown
6. User redirected to login page

**Default Role**: All new users get the `dispatcher` role by default. Admins can change this later.

### 2. User Login

**URL**: `/auth/login`

**Process**:
1. User enters email and password
2. Supabase authenticates user
3. Session created and stored in cookies
4. User redirected to dashboard
5. AuthContext loads user profile and role

**Demo Credentials** (if you've run the seed script):
- Admin: `admin@cargopulse.com`
- Dispatcher: `mike.johnson@cargopulse.com`
- Driver: `james.wilson@cargopulse.com`

### 3. Password Reset

**URL**: `/auth/forgot-password`

**Process**:
1. User enters email
2. Supabase sends password reset email
3. User clicks link in email
4. User sets new password
5. User redirected to login

### 4. Protected Routes

The middleware protects all routes by default:

- **Unauthenticated users**: Redirected to `/auth/login`
- **Authenticated users**: Can access dashboard and role-appropriate pages
- **Auth pages**: Hidden from logged-in users (redirects to dashboard)

## Usage Examples

### Signup a New User

1. Navigate to `/auth/signup`
2. Fill in the form:
   ```
   Full Name: Jane Smith
   Email: jane.smith@example.com
   Password: securepass123
   Confirm Password: securepass123
   ```
3. Click "Create Account"
4. Profile automatically created with "dispatcher" role
5. Redirected to login page

### Login

1. Navigate to `/auth/login`
2. Enter credentials
3. Click "Sign In"
4. Redirected to dashboard

### Assign Admin Role

After a user signs up, you can make them an admin:

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'jane.smith@example.com';
```

The user needs to sign out and sign in again to see the new permissions.

### Assign Driver Role

```sql
UPDATE profiles
SET role = 'driver'
WHERE email = 'john.doe@example.com';
```

## Role-Based Access

After authentication, the RBAC system controls what users can see:

| Role | Dashboard | Analytics | Fleet | Warehouse | My Tasks |
|------|-----------|-----------|-------|-----------|----------|
| Admin | ✅ | ✅ | ✅ | ✅ | ❌ |
| Dispatcher | ✅ | ❌ | ✅ | ✅ | ❌ |
| Driver | ✅ | ❌ | ❌ | ❌ | ✅ |

## Component Integration

### Using AuthContext

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, userRole, profile, loading, signOut } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please log in</div>;

  return (
    <div>
      <p>Welcome {profile?.full_name}</p>
      <p>Role: {userRole}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

### Protecting Pages

```tsx
import RoleGuard from '@/components/RoleGuard';

export default function AdminPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <div>Admin only content</div>
    </RoleGuard>
  );
}
```

## Middleware Configuration

The middleware in `src/middleware.ts` automatically:

1. Checks for authentication tokens
2. Redirects unauthenticated users to login
3. Prevents logged-in users from accessing auth pages
4. Preserves the original URL for post-login redirect

**Protected by Default**: All routes except `/auth/*` require authentication.

## Testing the System

### Test Signup Flow

1. Go to `http://localhost:3000/auth/signup`
2. Create a new account
3. Check Supabase dashboard → Authentication → Users
4. Check profiles table to confirm profile was created
5. Try logging in with new credentials

### Test Login Flow

1. Go to `http://localhost:3000/auth/login`
2. Enter credentials
3. Should redirect to dashboard
4. Check sidebar for correct navigation items based on role
5. Try accessing restricted pages (should show unauthorized or redirect)

### Test Password Reset

1. Go to `http://localhost:3000/auth/forgot-password`
2. Enter your email
3. Check email for reset link
4. Click link and set new password
5. Login with new password

### Test Role Changes

1. Login as a dispatcher
2. Note which navigation items are visible
3. In Supabase, change role to 'admin'
4. Sign out and sign in again
5. Should now see Analytics and all other admin features

## Security Features

### Client-Side Protection
- Protected routes via middleware
- Role-based component rendering
- Automatic redirect to login for unauthenticated access

### Server-Side Protection
- Row Level Security (RLS) on profiles table
- Users can only view their own profile
- Admins can view all profiles
- Auth trigger runs with SECURITY DEFINER

### Password Security
- Minimum 6 characters required
- Handled securely by Supabase Auth
- Password confirmation validation
- Reset functionality via email

## Troubleshooting

### Issue: "Email not confirmed"

**Solution**: Disable email confirmations in Supabase dashboard for testing, or click the confirmation link in your email.

### Issue: Profile not created after signup

**Solution**:
1. Check if trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
2. Verify trigger function: Check `public.handle_new_user()` exists
3. Check Supabase logs for errors

### Issue: Infinite redirect loop

**Solution**:
1. Clear browser cookies
2. Check middleware matcher pattern
3. Verify auth pages are excluded from protection

### Issue: Role not updating after change

**Solution**:
1. Sign out completely
2. Clear browser cache/cookies
3. Sign in again
4. If still not working, check if profile exists in database

### Issue: Can't access any pages after login

**Solution**:
1. Check browser console for errors
2. Verify AuthProvider wraps the app in LayoutClient.tsx
3. Check if profiles table has your user record
4. Verify RLS policies allow profile access

## Environment Variables

Make sure your `.env.local` file has:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Next Steps

1. **Customize Default Role**: Change the default role in the trigger if needed
2. **Add Email Templates**: Customize Supabase email templates for signup/reset
3. **Add Profile Editing**: Allow users to update their name and other details
4. **Add Admin Dashboard**: Create UI for admins to manage user roles
5. **Add Multi-Factor Auth**: Enable MFA in Supabase for additional security
6. **Add Social Auth**: Enable Google, GitHub, etc. in Supabase

## Additional Features to Implement

### User Profile Page
- Allow users to edit their name
- Change password functionality
- View account details

### Admin User Management
- List all users
- Change user roles
- Deactivate users
- View user activity

### Audit Logging
- Track role changes
- Log failed login attempts
- Monitor unauthorized access attempts

### Enhanced Security
- Rate limiting on login attempts
- IP-based restrictions
- Session timeout configuration
- Multi-factor authentication

## Support

For issues or questions:
1. Check Supabase dashboard logs
2. Check browser console for errors
3. Verify database schema and triggers
4. Review RBAC_SETUP.md for role configuration

## Summary

Your authentication system is now fully integrated with:
- ✅ Beautiful login/signup pages
- ✅ Automatic profile creation
- ✅ Route protection via middleware
- ✅ Role-based access control
- ✅ Password reset functionality
- ✅ Dark mode support

Users can now sign up, get assigned a default role, and access features based on their permissions!
