import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "steward" | "viewer";
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  isSteward: boolean;
  isEditor: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAdmin: false,
  isSteward: false,
  isEditor: false,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      localStorage.setItem("access_token", token);
      window.history.replaceState({}, "", window.location.pathname);
    }

    const stored = localStorage.getItem("access_token");

    // Try SSO auto-login if no token is stored
    if (!stored) {
      api
        .get<{ sso: boolean; access_token?: string }>("/auth/sso-check")
        .then(async (res) => {
          if (res.data.sso && res.data.access_token) {
            localStorage.setItem("access_token", res.data.access_token);
            const meRes = await api.get<AuthUser>("/auth/me");
            setUser(meRes.data);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
      return;
    }

    api
      .get<AuthUser>("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("access_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (token: string) => {
    localStorage.setItem("access_token", token);
    const res = await api.get<AuthUser>("/auth/me");
    setUser(res.data);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    }
    localStorage.removeItem("access_token");
    setUser(null);
    window.location.href = "/login";
  };

  const role = user?.role;
  const isAdmin = role === "admin";
  const isSteward = role === "admin" || role === "steward";
  const isEditor = isSteward;

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isSteward, isEditor, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
