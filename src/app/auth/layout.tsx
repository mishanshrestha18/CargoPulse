import { ReactNode } from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata = {
  title: 'Authentication - CargoPulse',
  description: 'Sign in or create an account for CargoPulse',
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
}
