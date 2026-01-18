'use client';

import { ReactNode, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import ShipmentMonitor from '@/components/ShipmentMonitor';
import { NotificationProvider, useNotifications } from '@/contexts/NotificationContext';
import NotificationSidebar from '@/components/NotificationSidebar';
import ToastContainer from '@/components/ToastContainer';
import AuthDebug from '@/components/AuthDebug';

function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show nothing (will redirect)
  if (!user) {
    return null;
  }

  return <>{children}</>;
}

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
          {/* Notification Bell Icon - positioned to not overlap with refresh button */}
          <div className="absolute top-4 right-20 z-30">
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
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth');
  const isUnauthorizedPage = pathname === '/unauthorized';

  // For auth pages, only wrap with ThemeProvider (no auth/notification providers needed)
  if (isAuthPage) {
    return (
      <ThemeProvider>
        {children}
      </ThemeProvider>
    );
  }

  // For unauthorized page, show without auth guard
  if (isUnauthorizedPage) {
    return (
      <ThemeProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGuard>
          <NotificationProvider>
            <LayoutContent>{children}</LayoutContent>
          </NotificationProvider>
        </AuthGuard>
      </AuthProvider>
    </ThemeProvider>
  );
}
