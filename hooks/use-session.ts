'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SessionUser } from '@/lib/auth/session';

interface UseSessionReturn {
  user: SessionUser | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch and manage user session
 * 
 * @returns Object containing user data, loading state, error state, and refetch function
 * 
 * @example
 * ```tsx
 * const { user, loading, error } = useSession();
 * if (loading) return <Loading />;
 * if (error) return <Error />;
 * if (user) return <Dashboard user={user} />;
 * ```
 */
export function useSession(): UseSessionReturn {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/session');
      const data = await response.json();

      if (!response.ok || !data.success) {
        // Not authenticated is not an error, just no user
        if (response.status === 401) {
          setUser(null);
          return;
        }
        throw new Error(data.error || 'Failed to fetch session');
      }

      setUser(data.user);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      setError(error);
      setUser(null);
      console.error('[useSession] Error fetching session:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return {
    user,
    loading,
    error,
    refetch: fetchSession,
  };
}

