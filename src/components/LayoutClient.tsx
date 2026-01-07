'use client';

import { ReactNode, useState } from 'react';
import { Bell } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { ThemeProvider } from '@/components/ThemeProvider';
import ShipmentMonitor from '@/components/ShipmentMonitor';
import { NotificationProvider, useNotifications } from '@/contexts/NotificationContext';
import NotificationSidebar from '@/components/NotificationSidebar';
import ToastContainer from '@/components/ToastContainer';

function LayoutContent({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <>
      <ShipmentMonitor />
      <ToastContainer />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 relative">
          {/* Notification Bell Icon */}
          <div className="absolute top-4 right-4 z-30">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="relative p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-md transition-colors"
              title="Open notifications"
            >
              <Bell className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          {children}
        </main>
      </div>
      <NotificationSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
    </>
  );
}

export default function LayoutClient({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <LayoutContent>{children}</LayoutContent>
      </NotificationProvider>
    </ThemeProvider>
  );
}
