'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import logger from '@/lib/logger';

export function SessionManager() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, _session: any) => {
      if (event === 'SIGNED_OUT') {
        logger.info('User signed out');
        router.push('/login');
      } else if (event === 'TOKEN_REFRESHED') {
        logger.debug('Session token refreshed');
      } else if (event === 'SIGNED_IN') {
        logger.info('User signed in');
      }
    });

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Supabase handles session refresh automatically
  return null;
}