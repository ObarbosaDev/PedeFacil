import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setAccessToken, type AuthResult, type SessionUser } from "./api";

type SessionContextValue = {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api<AuthResult>("/auth/refresh", { method: "POST" })
      .then((result) => {
        if (!mounted) return;
        setAccessToken(result.accessToken);
        setUser(result.user);
      })
      .catch(() => {
        if (mounted) setAccessToken(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  async function login(email: string, password: string) {
    const result = await api<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(result.accessToken);
    setUser(result.user);
  }

  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); }
    finally {
      setAccessToken(null);
      setUser(null);
    }
  }

  return (
    <SessionContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider ausente.");
  return session;
}
