'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import logger from '@/lib/logger';

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('=== AuthProvider Initialization ===');
      logger.debug('Supabase configuration loaded');
    }
    
    // 初回のセッション確認
    const checkSession = async () => {
      logger.debug('Checking session...');
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        logger.debug('Session check result:', { session: !!session, error });
        
        if (error) {
          logger.error('Session check error details:', error);
        }
        
        setUser(session?.user || null);
        logger.debug('User set to:', { email: session?.user?.email || 'null' });
      } catch (error) {
        logger.error('Session check exception:', error);
      } finally {
        logger.debug('Setting loading to false');
        setLoading(false);
      }
    };

    checkSession();

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}