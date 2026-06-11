/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  hasAdminPassword,
  setAdminPassword,
  verifyAdminPassword,
} from "../../services/db/settings";
import { maybeResetAdminPassword } from "../../services/adminAuth";

const AUTH_FLAG_KEY = "fliperama-admin-authed";

type AdminAuthValue = {
  isAuthed: boolean;
  /** null enquanto verifica; false = primeira vez (cadastrar senha). */
  passwordSet: boolean | null;
  login: (password: string) => Promise<boolean>;
  setupPassword: (password: string) => Promise<void>;
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
  const [passwordSet, setPasswordSet] = useState<boolean | null>(null);

  // Ao abrir: checa o reset por arquivo e se já existe senha cadastrada.
  useEffect(() => {
    let active = true;
    (async () => {
      const wasReset = await maybeResetAdminPassword();
      if (wasReset) {
        setIsAuthed(false);
        try {
          sessionStorage.removeItem(AUTH_FLAG_KEY);
        } catch {
          // ignore
        }
      }
      const exists = await hasAdminPassword().catch(() => false);
      if (active) setPasswordSet(exists);
    })();
    return () => {
      active = false;
    };
  }, []);

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

  const setupPassword = useCallback(async (password: string) => {
    await setAdminPassword(password);
    setPasswordSet(true);
    setIsAuthed(true);
    try {
      sessionStorage.setItem(AUTH_FLAG_KEY, "1");
    } catch {
      // ignore
    }
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
    () => ({ isAuthed, passwordSet, login, setupPassword, logout }),
    [isAuthed, passwordSet, login, setupPassword, logout],
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
