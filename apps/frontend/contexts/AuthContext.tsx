"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { login as apiLogin, getToken } from "@/lib/api";

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = getToken();
    if (stored) {
      setToken(stored);
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const accessToken = await apiLogin(email, password);
    // apiLogin already persists to localStorage via setToken
    setToken(accessToken);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("omni_token");
    setToken(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, login, logout }}>
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
