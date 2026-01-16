'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthDebug() {
  const { user, profile, userRole, loading } = useAuth();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  // Only show in development
  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-xl max-w-md text-xs font-mono z-50">
      <h3 className="font-bold text-sm mb-2">Auth Debug Info</h3>
      <div className="space-y-1">
        <p><span className="text-gray-400">Loading:</span> {loading ? '✅ Yes' : '❌ No'}</p>
        <p><span className="text-gray-400">User ID:</span> {user?.id || 'None'}</p>
        <p><span className="text-gray-400">Email:</span> {user?.email || 'None'}</p>
        <p><span className="text-gray-400">Session:</span> {session ? '✅ Active' : '❌ None'}</p>
        <p><span className="text-gray-400">Profile Loaded:</span> {profile ? '✅ Yes' : '❌ No'}</p>
        <p><span className="text-gray-400">Role:</span> {userRole || 'None'}</p>
        {profile && (
          <p><span className="text-gray-400">Full Name:</span> {profile.full_name || 'N/A'}</p>
        )}
      </div>
    </div>
  );
}
