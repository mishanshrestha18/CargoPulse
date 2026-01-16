# Quick Start: Authentication System

Get your CargoPulse authentication up and running in 5 minutes!

## ✅ Step-by-Step Setup

### 1. Database Setup (2 minutes)

**Copy the SQL script:**
```bash
# Windows (PowerShell)
Get-Content scripts\setup-auth-database.sql | Set-Clipboard

# Mac/Linux
cat scripts/setup-auth-database.sql | pbcopy
```

**Run in Supabase:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Paste the script
6. Click **Run** (or press Ctrl/Cmd + Enter)

**Expected Result:**
```
✓ profiles table created
✓ RLS policies created
✓ Trigger created
✓ Verification queries show success
```

### 2. Configure Supabase Auth (1 minute)

1. In Supabase Dashboard → **Authentication** → **Settings**
2. Scroll to **Site URL**: Enter `http://localhost:3000`
3. Scroll to **Redirect URLs**: Click **Add URL**
4. Add: `http://localhost:3000/**`
5. Click **Save**

**For testing only (optional):**
6. Scroll to **Email Auth**
7. Turn OFF "Enable email confirmations"
8. Click **Save**

### 3. Start Your App (30 seconds)

```bash
npm run dev
```

Open browser to: `http://localhost:3000`

You should be redirected to: `http://localhost:3000/auth/login`

### 4. Create Your First User (1 minute)

1. Click **"Sign up"** link
2. Fill in the form:
   - **Full Name**: Your Name
   - **Email**: your@email.com
   - **Password**: yourpassword
   - **Confirm Password**: yourpassword
3. Click **"Create Account"**
4. You'll see success message
5. Redirected to login page

### 5. Login (30 seconds)

1. Enter your email and password
2. Click **"Sign In"**
3. You're in! 🎉

You should now see:
- ✅ Dashboard
- ✅ Sidebar with navigation
- ✅ Your name and role ("dispatcher") in sidebar

### 6. Make Yourself an Admin (30 seconds)

**In Supabase SQL Editor, run:**
```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your@email.com';
```
*(Replace with your actual email)*

**Then:**
1. Click **Sign Out** in sidebar
2. Sign in again
3. Now you see **Analytics** in sidebar! 🎊

## 🎯 What You Just Built

- ✅ User signup with automatic profile creation
- ✅ User login with session management
- ✅ Role-based navigation (admin sees more options)
- ✅ Protected routes (can't access without login)
- ✅ Password reset functionality
- ✅ Dark mode support

## 🚀 Next Steps

### Test Different Roles

**Create more users:**
1. Sign out
2. Sign up with different email
3. In SQL, assign different role:

```sql
-- Make dispatcher
UPDATE profiles SET role = 'dispatcher' WHERE email = 'user2@email.com';

-- Make driver
UPDATE profiles SET role = 'driver' WHERE email = 'user3@email.com';
```

**Test what each role sees:**
- **Admin**: All navigation items except "My Tasks"
- **Dispatcher**: Fleet, Drivers, Warehouse, Maintenance (no Analytics)
- **Driver**: Only Dashboard and My Tasks

### Test Password Reset

1. Go to `/auth/forgot-password`
2. Enter your email
3. Check your email inbox
4. Click the reset link
5. Set new password
6. Login with new password

### Create Sample Users (Optional)

Run the seed script to create 14 test users:

```bash
# Copy seed script
Get-Content scripts\seed-profiles.sql | Set-Clipboard
# or: cat scripts/seed-profiles.sql | pbcopy
```

Paste and run in Supabase SQL Editor.

**Test users available:**
- admin@cargopulse.com (admin)
- mike.johnson@cargopulse.com (dispatcher)
- james.wilson@cargopulse.com (driver)

*(You still need to set passwords by signing up or password reset)*

## 📚 Documentation

- **Setup Guide**: [AUTH_SETUP_GUIDE.md](AUTH_SETUP_GUIDE.md)
- **RBAC Guide**: [RBAC_SETUP.md](RBAC_SETUP.md)
- **Flow Diagrams**: [AUTH_FLOW_DIAGRAM.md](AUTH_FLOW_DIAGRAM.md)
- **Full Reference**: [README_AUTHENTICATION.md](README_AUTHENTICATION.md)

## 🐛 Troubleshooting

### "Email not confirmed" error
**Fix**: Disable email confirmations in Supabase (Step 2, optional part)

### Can't see any pages after login
**Fix**:
1. Check browser console for errors
2. Verify AuthProvider is in LayoutClient.tsx (it is!)
3. Clear cookies and try again

### Profile not created
**Fix**:
1. Check if trigger exists (run verification queries from setup script)
2. Check Supabase logs for errors
3. Manually create profile:
```sql
INSERT INTO profiles (id, email, role, full_name)
VALUES (
  'user-id-from-auth-users',
  'your@email.com',
  'dispatcher',
  'Your Name'
);
```

### Middleware redirect loop
**Fix**:
1. Clear all cookies
2. Close browser
3. Open new browser window
4. Try again

## ✨ You're Done!

Your authentication system is ready. Users can:
- ✅ Sign up and get a profile automatically
- ✅ Login and stay logged in
- ✅ Reset their password if forgotten
- ✅ See different features based on their role
- ✅ Sign out when done

**Total setup time**: ~5 minutes
**Lines of code you wrote**: 0 (it's all done!)
**Features you got**: Complete auth system with RBAC

## 🎨 Features Overview

### Login Page (`/auth/login`)
- Email/password authentication
- "Remember me" feel (persistent session)
- Link to signup and password reset
- Demo credentials shown
- Error messages

### Signup Page (`/auth/signup`)
- Full name collection
- Email and password
- Password confirmation
- Validation (min 6 chars)
- Auto-profile creation with default role
- Success feedback

### Password Reset (`/auth/forgot-password`)
- Email-based reset
- Link sent via email
- Secure token handling
- Success confirmation

### Protected Routes
- All pages require login (except auth pages)
- Automatic redirect to login if not authenticated
- Automatic redirect to dashboard if authenticated and trying to access auth pages

### Role-Based Navigation
- **Admin** sees: Dashboard, Analytics, Fleet, Airplanes, Drivers, Warehouse, Maintenance
- **Dispatcher** sees: Dashboard, Fleet, Airplanes, Drivers, Warehouse, Maintenance
- **Driver** sees: Dashboard, My Tasks

### User Profile Display
- Name shown in sidebar
- Role badge displayed
- Sign out button
- Profile info from database

## 🔐 Security Features

- ✅ **Row Level Security** (RLS) on profiles table
- ✅ **Password hashing** (handled by Supabase)
- ✅ **Secure session tokens** (HTTP-only cookies)
- ✅ **CSRF protection** (built-in)
- ✅ **Email verification** (optional, can enable)
- ✅ **Rate limiting** (Supabase handles this)

## 📱 UI Features

- ✅ **Fully responsive** (works on mobile)
- ✅ **Dark mode** (automatic with theme toggle)
- ✅ **Loading states** (spinners during auth)
- ✅ **Error handling** (clear error messages)
- ✅ **Success feedback** (confirmation messages)
- ✅ **Form validation** (client-side checks)

## 🎯 Success!

You now have a production-ready authentication system integrated with role-based access control. Users can sign up, login, reset passwords, and access features based on their assigned roles.

Start building your features - the auth is handled! 🚀
