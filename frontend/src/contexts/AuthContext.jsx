import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("candidate_token");
    if (!token) {
      setUser(null);
      setChecking(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("candidate_token");
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = (token, userObj) => {
    localStorage.setItem("candidate_token", token);
    setUser(userObj);
  };

  const logout = () => {
    localStorage.removeItem("candidate_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, checking, login, logout, refresh: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
