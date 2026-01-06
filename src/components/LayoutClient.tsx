'use client';

import { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import { ThemeProvider } from '@/components/ThemeProvider';
import ShipmentMonitor from '@/components/ShipmentMonitor';

export default function LayoutClient({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ShipmentMonitor />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
