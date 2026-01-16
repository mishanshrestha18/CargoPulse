# Role-Based Access Control (RBAC) Setup Guide

## Overview

The CargoPulse application now includes a comprehensive Role-Based Access Control (RBAC) system that restricts access to features based on user roles.

## User Roles

The system supports three user roles:

1. **Admin** - Full access to all features
2. **Dispatcher** - Access to fleet management, dispatch, and warehouse operations
3. **Driver** - Limited access to view their assigned tasks

## Database Setup

### 1. Create Profiles Table

You need to create a `profiles` table in your Supabase database:

```sql
-- Create profiles table
CREATE TABLE profiles (
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
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2. Assign User Roles

After users sign up, you can manually assign roles via Supabase dashboard or SQL:

```sql
-- Set user as admin
UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';

-- Set user as dispatcher
UPDATE profiles SET role = 'dispatcher' WHERE email = 'dispatcher@example.com';

-- Set user as driver
UPDATE profiles SET role = 'driver' WHERE email = 'driver@example.com';
```

## Feature Access by Role

### Admin Role
- ✅ Dashboard
- ✅ Analytics (Admin only)
- ✅ Fleet Management
- ✅ Airplane Management
- ✅ Driver Management
- ✅ Warehouse
- ✅ Maintenance
- ❌ My Tasks (Driver only)

### Dispatcher Role
- ✅ Dashboard
- ❌ Analytics (Admin only)
- ✅ Fleet Management
- ✅ Airplane Management
- ✅ Driver Management
- ✅ Warehouse
- ✅ Maintenance
- ❌ My Tasks (Driver only)

### Driver Role
- ✅ Dashboard
- ❌ Analytics (Admin only)
- ❌ Fleet Management
- ❌ Airplane Management
- ❌ Driver Management
- ❌ Warehouse
- ❌ Maintenance
- ✅ My Tasks (Driver only)

## Implementation Components

### 1. AuthContext (`src/contexts/AuthContext.tsx`)

Provides authentication state and user role information throughout the app.

**Usage:**
```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, userRole, profile, loading, signOut } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please log in</div>;

  return (
    <div>
      <p>Welcome {profile?.full_name}</p>
      <p>Your role: {userRole}</p>
    </div>
  );
}
```

### 2. RoleGuard Component (`src/components/RoleGuard.tsx`)

Protects entire pages or sections based on user role.

**Usage - Page Protection:**
```tsx
import RoleGuard from '@/components/RoleGuard';

export default function AdminOnlyPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <div>This content is only visible to admins</div>
    </RoleGuard>
  );
}
```

**Usage - Multiple Roles:**
```tsx
<RoleGuard allowedRoles={['admin', 'dispatcher']}>
  <FleetManagement />
</RoleGuard>
```

**Usage - Custom Redirect:**
```tsx
<RoleGuard allowedRoles={['admin']} redirectTo="/dashboard">
  <AdminSettings />
</RoleGuard>
```

### 3. RoleCheck Component (Inline Role Checking)

For conditional rendering within components.

**Usage:**
```tsx
import { RoleCheck } from '@/components/RoleGuard';

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      <RoleCheck allowedRoles={['admin']}>
        <AdminDashboard />
      </RoleCheck>

      <RoleCheck allowedRoles={['dispatcher']}>
        <DispatcherDashboard />
      </RoleCheck>

      <RoleCheck allowedRoles={['driver']}>
        <DriverDashboard />
      </RoleCheck>
    </div>
  );
}
```

### 4. useHasRole Hook

Check if user has specific role programmatically.

**Usage:**
```tsx
import { useHasRole } from '@/components/RoleGuard';

function MyComponent() {
  const isAdmin = useHasRole(['admin']);
  const canDispatch = useHasRole(['admin', 'dispatcher']);

  return (
    <div>
      {isAdmin && <button>Admin Actions</button>}
      {canDispatch && <button>Create Shipment</button>}
    </div>
  );
}
```

### 5. Updated Sidebar (`src/components/Sidebar.tsx`)

The sidebar automatically filters navigation items based on user role:

- Shows user profile with name and role
- Displays only allowed navigation items
- Includes sign out button
- Dark mode compatible

## Wrapping Your App with AuthProvider

Make sure to wrap your entire app with the `AuthProvider` in your layout file:

```tsx
// src/app/layout.tsx
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

## Unauthorized Access Page

Users who try to access restricted pages will be redirected to `/unauthorized` which shows:

- Access denied message
- Current user role
- Options to go back or return to dashboard
- Contact information for assistance

## Testing the RBAC System

### 1. Create Test Users

Create users with different roles:

```sql
-- Create admin user (after signup)
UPDATE profiles SET role = 'admin', full_name = 'Admin User'
WHERE email = 'admin@test.com';

-- Create dispatcher user (after signup)
UPDATE profiles SET role = 'dispatcher', full_name = 'Dispatcher User'
WHERE email = 'dispatcher@test.com';

-- Create driver user (after signup)
UPDATE profiles SET role = 'driver', full_name = 'Driver User'
WHERE email = 'driver@test.com';
```

### 2. Test Access Control

1. Sign in as admin - should see all menu items including Analytics
2. Sign in as dispatcher - should see Fleet, Drivers, Warehouse, but not Analytics
3. Sign in as driver - should only see Dashboard and My Tasks
4. Try accessing restricted URLs directly - should redirect to /unauthorized

## Security Best Practices

1. **Never trust client-side checks alone** - Always implement Row Level Security (RLS) in Supabase
2. **Validate roles server-side** - Use Supabase RLS policies to enforce permissions
3. **Use HTTPS in production** - Ensure all communication is encrypted
4. **Regular role audits** - Periodically review user roles and permissions
5. **Principle of least privilege** - Give users only the permissions they need

## Troubleshooting

### Profile not loading
- Check if profiles table exists in Supabase
- Verify the trigger `on_auth_user_created` is enabled
- Check browser console for errors

### Role not updating
- Clear localStorage and refresh
- Sign out and sign back in
- Check if profile row exists for the user

### Unauthorized page showing for valid users
- Verify user's role in profiles table
- Check if AuthProvider is wrapping the app
- Ensure role matches allowedRoles array

## Additional Features

### Refresh Profile
If you update a user's role in the database, they can refresh their profile:

```tsx
const { refreshProfile } = useAuth();

<button onClick={refreshProfile}>Refresh Profile</button>
```

### Sign Out
The sidebar includes a sign-out button, but you can also trigger it programmatically:

```tsx
const { signOut } = useAuth();

<button onClick={signOut}>Sign Out</button>
```

## Future Enhancements

Possible improvements to the RBAC system:

1. **Permission-based access** - More granular permissions beyond roles
2. **Role hierarchy** - Inherit permissions from parent roles
3. **Temporary access** - Time-limited role assignments
4. **Audit logs** - Track who accessed what and when
5. **Multi-tenancy** - Support for multiple organizations
