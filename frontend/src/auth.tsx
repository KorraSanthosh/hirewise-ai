import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

export interface User { id: string; name: string; email: string; role: "recruiter" | "admin" | "candidate" }
interface Ctx { user: User | null; loading: boolean; login(email: string, password: string): Promise<User>; logout(): void }

const AuthContext = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (getToken()) api<User>("/api/auth/me").then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
    const onLogout = () => setUser(null);
    window.addEventListener("hw-logout", onLogout);
    return () => window.removeEventListener("hw-logout", onLogout);
  }, []);

  const login = async (email: string, password: string) => {
    const r = await api<{ accessToken: string; user: User }>("/api/auth/login", { body: { email, password } });
    setToken(r.accessToken);
    setUser(r.user);
    return r.user;
  };
  const logout = () => { setToken(null); setUser(null); };
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
