# CargoPulse Authentication Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                              │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐           │
│  │   Login    │  │   Signup   │  │ Password Reset  │           │
│  │   Page     │  │    Page    │  │      Page       │           │
│  └─────┬──────┘  └─────┬──────┘  └────────┬────────┘           │
└────────┼───────────────┼──────────────────┼─────────────────────┘
         │               │                  │
         │               │                  │
┌────────▼───────────────▼──────────────────▼─────────────────────┐
│                    Middleware (middleware.ts)                    │
│  • Check authentication status                                   │
│  • Redirect unauthenticated users to /auth/login                │
│  • Redirect authenticated users away from auth pages             │
└────────┬─────────────────────────────────┬─────────────────────┘
         │                                 │
         │                                 │
┌────────▼─────────────────────────────────▼─────────────────────┐
│                   AuthContext (AuthContext.tsx)                  │
│  • Manages authentication state                                  │
│  • Loads user profile and role                                   │
│  • Provides auth state to all components                         │
└────────┬─────────────────────────────────┬─────────────────────┘
         │                                 │
         │                                 │
┌────────▼─────────────────────────────────▼─────────────────────┐
│                  Supabase Auth Service                           │
│  • Authentication                                                │
│  • Session management                                            │
│  • Token storage                                                 │
└────────┬─────────────────────────────────────────────────────────┘
         │
         │
┌────────▼─────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                            │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │   auth.users     │────────▶│    profiles      │              │
│  │  (Supabase)      │ Trigger │  (Your table)    │              │
│  │                  │         │  • id            │              │
│  │  • id            │         │  • email         │              │
│  │  • email         │         │  • role          │              │
│  │  • password      │         │  • full_name     │              │
│  │  • created_at    │         │  • created_at    │              │
│  └──────────────────┘         └──────────────────┘              │
└───────────────────────────────────────────────────────────────────┘
```

## User Signup Flow

```
┌──────────┐
│  Start   │
└────┬─────┘
     │
     ▼
┌─────────────────────┐
│ User navigates to   │
│  /auth/signup       │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ User fills form:    │
│ • Full Name         │
│ • Email             │
│ • Password          │
│ • Confirm Password  │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Form Validation     │
│ • Password length   │
│ • Password match    │
│ • Email format      │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Call Supabase       │
│ auth.signUp()       │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Supabase creates    │
│ user in auth.users  │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Database Trigger    │
│ "on_auth_user_      │
│  created" fires     │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Profile created in  │
│ profiles table with │
│ default "dispatcher"│
│ role                │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Success message     │
│ shown to user       │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Auto-redirect to    │
│ /auth/login         │
└────┬────────────────┘
     │
     ▼
┌──────────┐
│   End    │
└──────────┘
```

## User Login Flow

```
┌──────────┐
│  Start   │
└────┬─────┘
     │
     ▼
┌─────────────────────┐
│ User navigates to   │
│  /auth/login        │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ User enters:        │
│ • Email             │
│ • Password          │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Call Supabase       │
│ auth.signInWith     │
│ Password()          │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Supabase validates  │
│ credentials         │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Session created     │
│ Tokens stored in    │
│ cookies             │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Redirect to         │
│ dashboard (/)       │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ AuthContext loads   │
│ user profile from   │
│ profiles table      │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ User role loaded    │
│ from profile        │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Sidebar filters     │
│ navigation based    │
│ on role             │
└────┬────────────────┘
     │
     ▼
┌──────────┐
│   End    │
└──────────┘
```

## Route Protection Flow

```
┌──────────┐
│  Start   │
└────┬─────┘
     │
     ▼
┌─────────────────────┐
│ User navigates to   │
│ any page            │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Middleware runs     │
│ (middleware.ts)     │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Check for auth      │
│ tokens in cookies   │
└────┬────────────────┘
     │
     ├─────────────────┐
     │                 │
Has Token          No Token
     │                 │
     ▼                 ▼
┌─────────────┐  ┌─────────────────┐
│ Is auth     │  │ Is auth page?   │
│ page?       │  │ (/auth/*)       │
└────┬────────┘  └────┬────────────┘
     │                │
    Yes               │
     │               No
     ▼                │
┌─────────────┐       │
│ Redirect to │       │
│ dashboard   │       │
└─────────────┘       │
                      ▼
               ┌─────────────────┐
               │ Redirect to     │
               │ /auth/login     │
               │ with redirect   │
               │ URL param       │
               └─────────────────┘
```

## Page Access by Role

```
┌──────────────────────────────────────────────────────────────┐
│                       All Pages                               │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
            ┌──────────────────┐
            │  Check User Role │
            └──────┬───────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
        ▼          ▼          ▼
   ┌────────┐ ┌──────────┐ ┌────────┐
   │ Admin  │ │Dispatcher│ │ Driver │
   └───┬────┘ └────┬─────┘ └───┬────┘
       │           │           │
       │           │           │
       ▼           ▼           ▼
 ┌──────────┐ ┌──────────┐ ┌──────────┐
 │ ✅ Dash  │ │ ✅ Dash  │ │ ✅ Dash  │
 │ ✅ Anal  │ │ ❌ Anal  │ │ ❌ Anal  │
 │ ✅ Fleet │ │ ✅ Fleet │ │ ❌ Fleet │
 │ ✅ Air   │ │ ✅ Air   │ │ ❌ Air   │
 │ ✅ Drvr  │ │ ✅ Drvr  │ │ ❌ Drvr  │
 │ ✅ Ware  │ │ ✅ Ware  │ │ ❌ Ware  │
 │ ✅ Maint │ │ ✅ Maint │ │ ❌ Maint │
 │ ❌ Tasks │ │ ❌ Tasks │ │ ✅ Tasks │
 └──────────┘ └──────────┘ └──────────┘
```

## Role Guard Protection Flow

```
┌──────────┐
│Component │
│with      │
│RoleGuard │
└────┬─────┘
     │
     ▼
┌─────────────────────┐
│ RoleGuard checks    │
│ allowedRoles prop   │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Get userRole from   │
│ AuthContext         │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Is userRole in      │
│ allowedRoles?       │
└────┬────────────────┘
     │
     ├─────────────┐
     │             │
    Yes           No
     │             │
     ▼             ▼
┌─────────┐  ┌─────────────┐
│ Render  │  │ Redirect to │
│ Content │  │/unauthorized│
└─────────┘  └─────────────┘
```

## Database Trigger Flow

```
┌──────────────────┐
│ New user created │
│ in auth.users    │
└────┬─────────────┘
     │
     ▼
┌─────────────────────────┐
│ Trigger fires:          │
│ "on_auth_user_created"  │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Function executes:      │
│ handle_new_user()       │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Extract data:           │
│ • User ID               │
│ • Email                 │
│ • Full name (metadata)  │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Insert into profiles:   │
│ • id = user.id          │
│ • email = user.email    │
│ • role = 'dispatcher'   │
│ • full_name = metadata  │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Profile created         │
│ Ready for login         │
└─────────────────────────┘
```

## Session Management

```
┌──────────────────┐
│ User logs in     │
└────┬─────────────┘
     │
     ▼
┌─────────────────────────┐
│ Supabase creates        │
│ session with tokens:    │
│ • Access token          │
│ • Refresh token         │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Tokens stored in        │
│ browser cookies:        │
│ • sb-access-token       │
│ • sb-refresh-token      │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ AuthContext listens     │
│ for auth state changes  │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ On session detected:    │
│ • Set user              │
│ • Fetch profile         │
│ • Set role              │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ User authenticated      │
│ Can access app          │
└─────────────────────────┘
```

## Sign Out Flow

```
┌──────────────────┐
│ User clicks      │
│ "Sign Out"       │
└────┬─────────────┘
     │
     ▼
┌─────────────────────────┐
│ Confirmation dialog     │
│ shown                   │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Call supabase.auth      │
│ .signOut()              │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Supabase invalidates    │
│ session                 │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Cookies cleared         │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ AuthContext updates:    │
│ • user = null           │
│ • profile = null        │
│ • userRole = null       │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Redirect to login       │
│ /auth/login             │
└─────────────────────────┘
```

## Password Reset Flow

```
┌──────────────────┐
│ User goes to     │
│ /auth/forgot-    │
│ password         │
└────┬─────────────┘
     │
     ▼
┌─────────────────────────┐
│ User enters email       │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Call supabase.auth      │
│ .resetPasswordForEmail()│
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Supabase sends email    │
│ with reset link         │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ User clicks link in     │
│ email                   │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Redirected to app with  │
│ reset token             │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ User sets new password  │
└────┬────────────────────┘
     │
     ▼
┌─────────────────────────┐
│ Password updated        │
│ User can login          │
└─────────────────────────┘
```

## Component Hierarchy

```
RootLayout (app/layout.tsx)
│
└─── LayoutClient (components/LayoutClient.tsx)
     │
     ├─── ThemeProvider
     │
     ├─── AuthProvider ◄── Manages auth state
     │    │
     │    └─── NotificationProvider
     │         │
     │         └─── LayoutContent
     │              │
     │              ├─── Sidebar ◄── Uses useAuth()
     │              │    │
     │              │    └─── Filtered navigation by role
     │              │
     │              └─── {children} ◄── Page content
     │                   │
     │                   └─── Pages can use:
     │                        • useAuth() hook
     │                        • RoleGuard component
     │                        • useHasRole() hook
```

## Key Files and Their Roles

```
📁 Authentication System

src/middleware.ts
├─ Protects all routes
└─ Redirects based on auth state

src/contexts/AuthContext.tsx
├─ Manages auth state globally
├─ Fetches user profile
└─ Exposes auth state to components

src/components/RoleGuard.tsx
├─ Protects pages by role
└─ Conditional rendering by role

src/app/auth/
├─ login/page.tsx       → Login form
├─ signup/page.tsx      → Signup form
├─ forgot-password/     → Password reset
└─ layout.tsx           → Auth layout

src/components/Sidebar.tsx
├─ Shows filtered navigation
└─ Displays user profile

scripts/setup-auth-database.sql
├─ Creates profiles table
├─ Sets up RLS policies
└─ Creates auto-profile trigger
```

## Summary

This authentication system provides:

1. **Complete user management** - Signup, login, password reset
2. **Automatic profile creation** - Trigger creates profile on signup
3. **Role-based access** - Three roles with different permissions
4. **Route protection** - Middleware guards all routes
5. **Session management** - Persistent login across refreshes
6. **Security** - RLS policies, secure cookies, CSRF protection

All working together to create a secure, user-friendly authentication experience!
