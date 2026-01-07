'use client';

import { useState, useEffect, useCallback } from 'react';
import ToastNotification from './ToastNotification';
import type { NotificationType } from '@/contexts/NotificationContext';

interface Toast {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
}

let addToastCallback: ((type: NotificationType, title: string, message: string) => void) | null = null;

// Global function to show toasts from anywhere
export function showToast(type: NotificationType, title: string, message: string) {
  if (addToastCallback) {
    addToastCallback(type, title, message);
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: NotificationType, title: string, message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  useEffect(() => {
    // Register the callback
    addToastCallback = addToast;
    return () => {
      addToastCallback = null;
    };
  }, [addToast]);

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm">
      {toasts.map(toast => (
        <ToastNotification
          key={toast.id}
          id={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onClose={removeToast}
        />
      ))}
    </div>
  );
}
