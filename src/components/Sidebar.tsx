'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Truck,
  Warehouse,
  LayoutDashboard,
  Sun,
  Moon,
  Users,
  Plane,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Wrench,
  ClipboardList,
  LogOut,
  User,
  AlertTriangle,
  X,
  MapPin,
  Receipt,
  Package,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useAuth, UserRole } from '@/contexts/AuthContext';

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  allowedRoles?: UserRole[];
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Shipments', href: '/shipments', icon: Package },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, allowedRoles: ['admin'] },
  { name: 'Locations', href: '/locations', icon: MapPin, allowedRoles: ['admin', 'dispatcher'] },
  { name: 'Fleet', href: '/fleet', icon: Truck, allowedRoles: ['admin', 'dispatcher'] },
  { name: 'Airplanes', href: '/airplanes', icon: Plane, allowedRoles: ['admin', 'dispatcher'] },
  { name: 'Drivers', href: '/drivers', icon: Users, allowedRoles: ['admin', 'dispatcher'] },
  { name: 'Pilots', href: '/pilots', icon: Plane, allowedRoles: ['admin', 'dispatcher'] },
  { name: 'Warehouse', href: '/warehouse', icon: Warehouse, allowedRoles: ['admin', 'dispatcher'] },
  { name: 'My Tasks', href: '/my-tasks', icon: ClipboardList, allowedRoles: ['driver'] },
  { name: 'Expenses', href: '/expenses', icon: Receipt, allowedRoles: ['admin', 'driver'] },
  { name: 'Maintenance', href: '/maintenance', icon: Wrench, allowedRoles: ['admin', 'dispatcher'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { userRole, profile, signOut, loading } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  // Filter navigation based on user role
  const filteredNavigation = navigation.filter((item) => {
    // If no roles specified, show to everyone
    if (!item.allowedRoles) return true;

    // If user has no role, don't show role-restricted items
    if (!userRole) return false;

    // Check if user's role is in allowed roles
    return item.allowedRoles.includes(userRole);
  });

  const handleSignOut = async () => {
    setShowSignOutModal(false);
    await signOut();
    window.location.href = '/auth/login';
  };

  return (
    <div className={`flex h-screen flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Header with Logo and Theme Toggle */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4">
        {!isCollapsed && (
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">CargoPulse</h1>
          </Link>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </button>
          {isCollapsed && (
            <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <LayoutDashboard className="h-5 w-5 text-gray-900 dark:text-gray-100" />
            </Link>
          )}
        </div>
      </div>

      {/* User Info */}
      {!loading && !isCollapsed && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {profile?.full_name || profile?.email || 'User'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {userRole || 'Loading...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? item.name : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Sign Out Button - Always show when not loading */}
      {!loading && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-3">
          <button
            onClick={() => setShowSignOutModal(true)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? 'Sign out' : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      )}

      {/* Collapse Toggle Button */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors w-full ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Sign Out
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Are you sure you want to sign out? You'll need to log in again to access your account.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowSignOutModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowSignOutModal(false)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
