import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

export interface AuthContextType {
  session: Session | null;
  user: User | undefined;
  isLogin: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: undefined,
  isLogin: false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | undefined>(undefined);
  const isLogin = useMemo<boolean>(() => !!(session?.user), [session]);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(undefined);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  useEffect(() => {
    setLoading(true);
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error fetching session:", error);
      } else {
        setSession(data.session);
        setUser(data.session?.user);
      }
      setLoading(false);
    };

    checkUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, _session: Session | null) => {
        setSession(_session);
        setUser(_session?.user);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);
  
  return (
    <AuthContext.Provider value={{session, isLogin, user, logout}}>
      { children }
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);