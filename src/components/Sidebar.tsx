'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Truck, Warehouse, LayoutDashboard, Sun, Moon, Users, Plane } from 'lucide-react';
import { useTheme } from './ThemeProvider';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Fleet', href: '/fleet', icon: Truck },
  { name: 'Airplanes', href: '/airplanes', icon: Plane },
  { name: 'Drivers', href: '/drivers', icon: Users },
  { name: 'Warehouse', href: '/warehouse', icon: Warehouse },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen w-64 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <Link
        href="/"
        className="flex h-16 items-center border-b border-gray-200 dark:border-gray-700 px-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">CargoPulse</h1>
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
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
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors w-full"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <>
              <Moon className="h-5 w-5" />
              <span>Dark Mode</span>
            </>
          ) : (
            <>
              <Sun className="h-5 w-5" />
              <span>Light Mode</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
