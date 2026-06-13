"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  getMe,
} from "@/lib/api";
import type { User } from "@/lib/types";
import {
  AUTH_SESSION_EXPIRED_EVENT,
  bootstrapSession,
  getAccessToken,
  setAccessToken,
} from "@/lib/authSession";

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthReady: boolean;
  isAdmin: boolean;
  user: User | null;
  token: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string, username?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const applySession = useCallback((accessToken: string | null) => {
    setAccessToken(accessToken);
    setToken(accessToken);
    setIsAuthenticated(!!accessToken);
    if (!accessToken) setUser(null);
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setUser(await getMe());
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    bootstrapSession()
      .then(async (accessToken) => {
        applySession(accessToken);
        if (accessToken) await loadProfile();
      })
      .finally(() => setIsAuthReady(true));

    const onExpired = () => applySession(null);
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onExpired);
  }, [applySession, loadProfile]);

  const login = async (identifier: string, password: string) => {
    const accessToken = await apiLogin(identifier, password);
    applySession(accessToken);
    await loadProfile();
  };

  const register = async (email: string, name: string, password: string, username?: string) => {
    const accessToken = await apiRegister(email, name, password, username);
    applySession(accessToken);
    await loadProfile();
  };

  const logout = async () => {
    await apiLogout();
    applySession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isAuthReady,
        isAdmin: !!user?.is_admin,
        user,
        token,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
