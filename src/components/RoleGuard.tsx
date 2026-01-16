'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export default function RoleGuard({
  allowedRoles,
  children,
  fallback,
  redirectTo = '/unauthorized',
}: RoleGuardProps) {
  const { userRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && userRole && !allowedRoles.includes(userRole)) {
      router.push(redirectTo);
    }
  }, [userRole, loading, allowedRoles, redirectTo, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user has required role
  if (!userRole || !allowedRoles.includes(userRole)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return null;
  }

  // User has required role, render children
  return <>{children}</>;
}

/**
 * Hook to check if user has a specific role
 * Useful for conditional rendering within components
 */
export function useHasRole(roles: UserRole[]): boolean {
  const { userRole } = useAuth();

  if (!userRole) return false;
  return roles.includes(userRole);
}

/**
 * Component for inline role-based rendering
 * Usage: <RoleCheck allowedRoles={['admin']}>Admin only content</RoleCheck>
 */
export function RoleCheck({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}) {
  const hasRole = useHasRole(allowedRoles);

  if (!hasRole) return null;

  return <>{children}</>;
}
