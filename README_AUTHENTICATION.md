# CargoPulse Authentication System

Complete authentication system with user signup, login, password reset, and role-based access control.

## Quick Start

### 1. Set Up Database (One-time setup)

Run the setup script in your Supabase SQL Editor:

```bash
# Copy the script contents
cat scripts/setup-auth-database.sql
```

Then paste and execute in **Supabase Dashboard → SQL Editor**.

### 2. Configure Supabase Settings

In **Supabase Dashboard → Authentication → Settings**:

- ✅ Enable Email provider
- ✅ Set Site URL: `http://localhost:3000`
- ✅ Add Redirect URL: `http://localhost:3000/**`
- ⚠️ (Optional) Disable email confirmations for local testing

### 3. Start the App

```bash
npm run dev
```

### 4. Create Your First User

1. Navigate to `http://localhost:3000/auth/signup`
2. Fill in your details
3. Create account
4. Login at `http://localhost:3000/auth/login`

### 5. Make Yourself an Admin

Run this SQL in Supabase (replace with your email):

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

Sign out and sign back in to see admin features.

## Features

### Authentication Pages

| Page | Path | Description |
|------|------|-------------|
| Login | `/auth/login` | Sign in with email/password |
| Signup | `/auth/signup` | Create new account |
| Password Reset | `/auth/forgot-password` | Reset password via email |
| Unauthorized | `/unauthorized` | Access denied page |

### Automatic Features

- ✅ **Auto Profile Creation**: Profile created automatically on signup
- ✅ **Default Role Assignment**: New users get "dispatcher" role
- ✅ **Route Protection**: Unauthenticated users redirected to login
- ✅ **Session Management**: Persistent login across page refreshes
- ✅ **Role-Based UI**: Navigation adapts to user role

### Security Features

- 🔒 Row Level Security (RLS) on profiles table
- 🔒 Password minimum 6 characters
- 🔒 Protected routes via middleware
- 🔒 Secure token storage in cookies
- 🔒 CSRF protection

## User Roles

### Admin
- Full access to all features
- Can view Analytics
- Can manage Fleet, Drivers, Warehouse, Maintenance
- Cannot see "My Tasks" (driver feature)

### Dispatcher (Default)
- Can manage Fleet, Drivers, Warehouse, Maintenance
- Cannot view Analytics (admin only)
- Cannot see "My Tasks" (driver feature)

### Driver
- Limited access
- Can only view Dashboard and My Tasks
- Cannot access management features

## Pages and Components

### Auth Pages

**Login Page** - [src/app/auth/login/page.tsx](src/app/auth/login/page.tsx)
- Email/password login
- Remember me functionality
- Link to signup and password reset
- Demo credentials display
- Error handling

**Signup Page** - [src/app/auth/signup/page.tsx](src/app/auth/signup/page.tsx)
- User registration form
- Password validation and confirmation
- Full name collection
- Automatic profile creation
- Success feedback

**Password Reset** - [src/app/auth/forgot-password/page.tsx](src/app/auth/forgot-password/page.tsx)
- Email-based password reset
- Success confirmation
- Back to login link

### Core Components

**AuthContext** - [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- Global authentication state
- User profile management
- Role access
- Sign out functionality

**RoleGuard** - [src/components/RoleGuard.tsx](src/components/RoleGuard.tsx)
- Page-level protection
- Role-based rendering
- Redirect on unauthorized access

**Sidebar** - [src/components/Sidebar.tsx](src/components/Sidebar.tsx)
- Role-filtered navigation
- User profile display
- Sign out button

**Middleware** - [src/middleware.ts](src/middleware.ts)
- Route protection
- Auto-redirect logic
- Session validation

## Usage Examples

### Protecting a Page

```tsx
import RoleGuard from '@/components/RoleGuard';

export default function AdminPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <div>Admin content here</div>
    </RoleGuard>
  );
}
```

### Checking User Role

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { userRole, profile, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <p>Welcome {profile?.full_name}</p>
      <p>Your role: {userRole}</p>
    </div>
  );
}
```

### Conditional Rendering by Role

```tsx
import { useHasRole } from '@/components/RoleGuard';

function Dashboard() {
  const isAdmin = useHasRole(['admin']);
  const canDispatch = useHasRole(['admin', 'dispatcher']);

  return (
    <div>
      {isAdmin && <AdminDashboard />}
      {canDispatch && <DispatcherTools />}
    </div>
  );
}
```

## Database Schema

### profiles Table

```sql
id          UUID PRIMARY KEY (references auth.users)
email       TEXT NOT NULL
role        TEXT (admin | dispatcher | driver)
full_name   TEXT
created_at  TIMESTAMP WITH TIME ZONE
updated_at  TIMESTAMP WITH TIME ZONE
```

### Policies

1. **Users can view their own profile** - Users see only their data
2. **Admins can view all profiles** - Admins have full visibility
3. **Users can update their own profile** - Self-service profile editing
4. **Enable insert for authentication** - Allow profile creation on signup

### Trigger

**on_auth_user_created** - Automatically creates profile when user signs up

## Common Tasks

### Change a User's Role

```sql
-- Make user an admin
UPDATE profiles SET role = 'admin' WHERE email = 'user@example.com';

-- Make user a dispatcher
UPDATE profiles SET role = 'dispatcher' WHERE email = 'user@example.com';

-- Make user a driver
UPDATE profiles SET role = 'driver' WHERE email = 'user@example.com';
```

User must sign out and sign in again to see new permissions.

### View All Users

```sql
SELECT
  full_name,
  email,
  role,
  created_at
FROM profiles
ORDER BY created_at DESC;
```

### Count Users by Role

```sql
SELECT
  role,
  COUNT(*) as count
FROM profiles
GROUP BY role;
```

### Delete a User

```sql
-- This will cascade and delete the profile too
DELETE FROM auth.users WHERE email = 'user@example.com';
```

## Troubleshooting

### Problem: Can't login after signup

**Solution**: Check if email confirmation is required in Supabase settings. Disable it for local testing.

### Problem: Profile not created

**Solution**:
1. Check if trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
2. Check Supabase logs for errors
3. Verify trigger function exists

### Problem: Wrong navigation items showing

**Solution**:
1. Check user's role in database: `SELECT role FROM profiles WHERE email = 'your@email.com';`
2. Sign out and sign in again
3. Clear browser cookies

### Problem: Redirect loop

**Solution**:
1. Clear browser cookies and cache
2. Check middleware configuration
3. Verify auth tokens in browser dev tools

### Problem: "useAuth must be used within an AuthProvider"

**Solution**: This has been fixed. AuthProvider is already in [src/components/LayoutClient.tsx](src/components/LayoutClient.tsx:50).

## Testing

### Test User Signup

```bash
# 1. Navigate to signup page
http://localhost:3000/auth/signup

# 2. Fill in form
Full Name: Test User
Email: test@example.com
Password: test123456

# 3. Verify in Supabase
# Check auth.users and profiles tables
```

### Test Role-Based Access

```bash
# 1. Login as dispatcher
# 2. Verify you DON'T see Analytics in sidebar
# 3. Try accessing /analytics directly (should redirect to /unauthorized)
# 4. Change role to admin in database
# 5. Sign out and sign in
# 6. Verify you NOW see Analytics
```

### Test Password Reset

```bash
# 1. Go to /auth/forgot-password
# 2. Enter your email
# 3. Check email for reset link
# 4. Click link and set new password
# 5. Login with new password
```

## File Reference

```
src/
├── app/
│   ├── auth/
│   │   ├── layout.tsx                    # Auth layout with theme
│   │   ├── login/page.tsx                # Login page
│   │   ├── signup/page.tsx               # Signup page
│   │   └── forgot-password/page.tsx      # Password reset
│   └── unauthorized/page.tsx             # Access denied
├── components/
│   ├── RoleGuard.tsx                     # Role protection
│   ├── Sidebar.tsx                       # Nav with role filtering
│   └── LayoutClient.tsx                  # Main layout with providers
├── contexts/
│   └── AuthContext.tsx                   # Auth state management
├── middleware.ts                         # Route protection
└── lib/
    └── supabase.ts                       # Supabase client

scripts/
├── setup-auth-database.sql               # Database setup script
└── seed-profiles.sql                     # Sample user data

docs/
├── AUTH_SETUP_GUIDE.md                   # Detailed setup guide
├── RBAC_SETUP.md                         # RBAC documentation
└── RBAC_TESTING_CHECKLIST.md             # Testing guide
```

## Environment Variables

Required in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Design

### Colors
- Primary: Blue (600)
- Success: Green (600)
- Error: Red (600)
- Background: Gradient blue to indigo

### Features
- ✅ Fully responsive
- ✅ Dark mode support
- ✅ Loading states
- ✅ Error handling
- ✅ Success feedback
- ✅ Form validation

## Next Steps

1. **Test the System**
   - Create test users
   - Test all roles
   - Verify permissions

2. **Customize**
   - Change default role if needed
   - Add more profile fields
   - Customize email templates in Supabase

3. **Enhance**
   - Add profile editing page
   - Add admin user management UI
   - Add audit logging
   - Enable social auth (Google, GitHub)
   - Add multi-factor authentication

## Support

- 📖 Full Setup Guide: [AUTH_SETUP_GUIDE.md](AUTH_SETUP_GUIDE.md)
- 🔐 RBAC Documentation: [RBAC_SETUP.md](RBAC_SETUP.md)
- ✅ Testing Guide: [RBAC_TESTING_CHECKLIST.md](RBAC_TESTING_CHECKLIST.md)

## Summary

Your CargoPulse authentication system is complete with:

✅ Beautiful, responsive auth pages
✅ Automatic profile creation on signup
✅ Default role assignment (dispatcher)
✅ Protected routes via middleware
✅ Role-based navigation
✅ Password reset functionality
✅ Dark mode support
✅ Complete RBAC integration

Users can now sign up, get assigned roles, and access features based on their permissions!
