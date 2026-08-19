'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from './api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('pulseseat_token');
    if (savedToken) {
      setToken(savedToken);
      apiClient
        .getMe(savedToken)
        .then((res: any) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('pulseseat_token');
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res: any = await apiClient.login({ email, password });
    const { user: u, token: t } = res.data;
    localStorage.setItem('pulseseat_token', t);
    setToken(t);
    setUser(u);
  };

  const signup = async (name: string, email: string, password: string) => {
    const res: any = await apiClient.signup({ name, email, password });
    const { user: u, token: t } = res.data;
    localStorage.setItem('pulseseat_token', t);
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('pulseseat_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        signup,
        logout,
        isAdmin: user?.role === 'ADMIN',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
