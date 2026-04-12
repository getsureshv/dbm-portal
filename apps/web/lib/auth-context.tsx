'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth as authApi } from './api';

export interface User {
  id: string;
  email: string;
  role: 'OWNER' | 'PROVIDER' | 'ADMIN' | null;
  providerType: 'PROFESSIONAL' | 'SUPPLIER' | 'FREIGHT' | null;
  name: string | null;
  phone: string | null;
  onboardingComplete: boolean;
  verificationStatus: boolean | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (firebaseIdToken: string) => Promise<void>;
  devLogin: (email: string, uid: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_PATHS = ['/', '/login'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.me();
      setUser(data.user ?? null);
      setError(null);
    } catch {
      setUser(null);
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  // Redirect unauthenticated users away from protected pages
  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_PATHS.includes(pathname);
    if (!user && !isPublic) {
      router.replace('/login');
    }
  }, [user, loading, pathname, router]);

  const login = useCallback(async (firebaseIdToken: string) => {
    try {
      setError(null);
      const data = await authApi.createSession(firebaseIdToken);
      setUser(data.user);
      // Route based on onboarding status
      if (!data.user.onboardingComplete) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    }
  }, [router]);

  // Dev-mode login: send a mock JSON token that the backend accepts in NODE_ENV=development
  const devLogin = useCallback(async (email: string, uid: string) => {
    const mockToken = JSON.stringify({ email, uid });
    await login(mockToken);
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore — cookie might already be cleared
    }
    setUser(null);
    router.replace('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, devLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
