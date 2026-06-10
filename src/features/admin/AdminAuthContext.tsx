/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { verifyAdminPassword } from "../../services/db/settings";

const AUTH_FLAG_KEY = "fliperama-admin-authed";

type AdminAuthValue = {
  isAuthed: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
};

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(AUTH_FLAG_KEY) === "1";
    } catch {
      return false;
    }
  });

  const login = useCallback(async (password: string) => {
    const ok = await verifyAdminPassword(password);
    if (ok) {
      setIsAuthed(true);
      try {
        sessionStorage.setItem(AUTH_FLAG_KEY, "1");
      } catch {
        // ignore
      }
    }
    return ok;
  }, []);

  const logout = useCallback(() => {
    setIsAuthed(false);
    try {
      sessionStorage.removeItem(AUTH_FLAG_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<AdminAuthValue>(
    () => ({ isAuthed, login, logout }),
    [isAuthed, login, logout],
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return ctx;
}
