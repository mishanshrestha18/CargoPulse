'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'admin' | 'dispatcher' | 'driver' | null;

interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cache keys for localStorage
const PROFILE_CACHE_KEY = 'cargopulse_profile_cache';
const ROLE_CACHE_KEY = 'cargopulse_role_cache';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(() => {
    // Initialize from cache if available
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(ROLE_CACHE_KEY);
      return cached ? (cached as UserRole) : null;
    }
    return null;
  });
  const [profile, setProfile] = useState<Profile | null>(() => {
    // Initialize from cache if available
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(PROFILE_CACHE_KEY);
      try {
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const profileFetchInProgress = useRef(false);

  // Helper to save to cache
  const saveToCache = (profileData: Profile | null, role: UserRole) => {
    if (typeof window !== 'undefined') {
      if (profileData) {
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profileData));
      } else {
        localStorage.removeItem(PROFILE_CACHE_KEY);
      }
      if (role) {
        localStorage.setItem(ROLE_CACHE_KEY, role);
      } else {
        localStorage.removeItem(ROLE_CACHE_KEY);
      }
    }
  };

  const fetchProfile = async (userId: string) => {
    // Prevent concurrent profile fetches
    if (profileFetchInProgress.current) {
      console.log('Profile fetch already in progress, skipping...');
      return;
    }

    profileFetchInProgress.current = true;

    try {
      console.log('Fetching profile for user:', userId);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      );

      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) {
        console.error('Error fetching profile:', error);
        console.error('Error details:', JSON.stringify(error));
        // Use cached role if available, otherwise fallback
        const cachedRole = localStorage.getItem(ROLE_CACHE_KEY) as UserRole;
        const fallbackRole = cachedRole || 'dispatcher';
        setUserRole(fallbackRole);
        return;
      }

      if (data) {
        console.log('Profile loaded:', data);
        setProfile(data);
        setUserRole(data.role as UserRole);
        // Save to cache for persistence across refreshes
        saveToCache(data, data.role);
      } else {
        console.warn('No profile data returned');
        // Use cached role if available
        const cachedRole = localStorage.getItem(ROLE_CACHE_KEY) as UserRole;
        setUserRole(cachedRole || 'dispatcher');
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      // Use cached role if available
      const cachedRole = localStorage.getItem(ROLE_CACHE_KEY) as UserRole;
      setUserRole(cachedRole || 'dispatcher');
    } finally {
      profileFetchInProgress.current = false;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setUserRole(null);
      setProfile(null);
      // Clear cache on sign out
      saveToCache(null, null);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Wait for profile fetch to complete before setting loading to false
          await fetchProfile(session.user.id);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setUserRole(null);
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    user,
    session,
    userRole,
    profile,
    loading,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
