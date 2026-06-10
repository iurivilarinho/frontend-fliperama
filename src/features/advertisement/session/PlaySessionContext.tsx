/* eslint-disable react-refresh/only-export-components */
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  computeExpiresAt,
  parseStoredSession,
  remainingSecondsFrom,
  restoreSessionState,
  type SessionStatus,
} from "./sessionTime";
import {
  createSession,
  expireStaleSessions,
  markSessionStatus,
} from "../../../services/db/sessions";
import { backupSaves } from "../../../services/saves";

const DEFAULT_MINUTES_OPTIONS = [5, 10, 15] as const;
const SESSION_STORAGE_KEY = "arcade-play-session";

export type SessionPaymentInfo = {
  amountCents: number;
  providerId?: string | null;
  status?: string;
};

type PlaySessionContextValue = {
  status: SessionStatus;
  durationOptionsMinutes: readonly number[];
  selectedDurationMinutes: number | null;
  remainingSeconds: number;
  startSession: (minutes: number, payment?: SessionPaymentInfo) => void;
  resetSession: () => void;
  isSessionActive: boolean;
};

const PlaySessionContext = createContext<PlaySessionContextValue | null>(null);

async function pinMiniOverlayWindow() {
  await invoke("ensure_overlay_mini_window");
  const overlayMini = await WebviewWindow.getByLabel("overlay_mini");
  if (!overlayMini) return;
  await overlayMini.setAlwaysOnTop(true);
  await overlayMini.show();
  await overlayMini.unminimize();
}

async function closeMiniOverlayWindow() {
  await invoke("close_overlay_mini_window");
}

function isMiniOverlay(): boolean {
  return window.location.pathname === "/player-mini";
}

function persistSession(value: {
  expiresAtMs: number;
  durationMinutes: number;
  sessionId: number | null;
}) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function clearPersistedSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function PlaySessionProvider({ children }: { children: ReactNode }) {
  const isMiniOverlayWindow = isMiniOverlay();

  // Restaura a sessão a partir do timestamp absoluto persistido (sobrevive a
  // refresh/reconexão). A janela de mini-overlay não controla o tempo.
  const initial = isMiniOverlayWindow
    ? restoreSessionState(null, Date.now())
    : restoreSessionState(
        parseStoredSession(localStorage.getItem(SESSION_STORAGE_KEY)),
        Date.now(),
      );

  const [status, setStatus] = useState<SessionStatus>(initial.status);
  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState<
    number | null
  >(initial.durationMinutes);
  const [remainingSeconds, setRemainingSeconds] = useState(
    initial.remainingSeconds,
  );

  const expiresAtRef = useRef<number | null>(initial.expiresAtMs);
  const sessionIdRef = useRef<number | null>(initial.sessionId);

  const isSessionActive = status === "active" && remainingSeconds > 0;

  // Limpa no boot quaisquer sessões que ficaram "active" além do tempo.
  useEffect(() => {
    if (isMiniOverlayWindow) return;
    void expireStaleSessions();
    // Se o estado restaurado já está expirado, garante limpeza.
    if (initial.status === "expired") {
      clearPersistedSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSession = useCallback(
    (minutes: number, payment?: SessionPaymentInfo) => {
      if (!Number.isFinite(minutes) || minutes <= 0) return;

      const now = Date.now();
      const expiresAtMs = computeExpiresAt(now, minutes);

      setSelectedDurationMinutes(minutes);
      setRemainingSeconds(minutes * 60);
      setStatus("active");
      expiresAtRef.current = expiresAtMs;
      sessionIdRef.current = null;

      persistSession({ expiresAtMs, durationMinutes: minutes, sessionId: null });

      void createSession({
        durationMinutes: minutes,
        expiresAtMs,
        payment: payment ?? null,
      }).then((id) => {
        sessionIdRef.current = id;
        if (id != null) {
          persistSession({
            expiresAtMs,
            durationMinutes: minutes,
            sessionId: id,
          });
        }
      });
    },
    [],
  );

  const resetSession = useCallback(() => {
    if (status === "active") {
      void markSessionStatus(sessionIdRef.current, "ended");
    }
    setStatus("idle");
    setRemainingSeconds(0);
    setSelectedDurationMinutes(null);
    expiresAtRef.current = null;
    sessionIdRef.current = null;
    clearPersistedSession();
  }, [status]);

  // Tick: recalcula o restante a partir do timestamp absoluto (robusto a
  // drift, sleep do SO e troca de aba). Ao zerar, expira e bloqueia.
  useEffect(() => {
    if (isMiniOverlayWindow) return;
    if (status !== "active") return;

    const tick = () => {
      const expiresAtMs = expiresAtRef.current;
      if (expiresAtMs == null) return;

      const remaining = remainingSecondsFrom(expiresAtMs, Date.now());
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        setStatus("expired");
        void markSessionStatus(sessionIdRef.current, "expired");
        // Backup automático dos saves ao encerrar a sessão.
        void backupSaves();
        clearPersistedSession();
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [isMiniOverlayWindow, status]);

  useEffect(() => {
    if (isMiniOverlayWindow) return;
    if (isSessionActive) {
      pinMiniOverlayWindow().catch(() => {});
      return;
    }
    closeMiniOverlayWindow().catch(() => {});
  }, [isMiniOverlayWindow, isSessionActive]);

  useEffect(() => {
    if (isMiniOverlayWindow) return;
    const main = getCurrentWindow();
    main.setAlwaysOnTop(!isSessionActive).catch(() => {});
  }, [isMiniOverlayWindow, isSessionActive]);

  useEffect(() => {
    if (isMiniOverlayWindow || !isSessionActive) return;

    const repin = () => {
      pinMiniOverlayWindow().catch(() => {});
    };

    const timer = window.setInterval(repin, 1500);
    window.addEventListener("focus", repin);
    document.addEventListener("visibilitychange", repin);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", repin);
      document.removeEventListener("visibilitychange", repin);
    };
  }, [isMiniOverlayWindow, isSessionActive]);

  const value = useMemo<PlaySessionContextValue>(
    () => ({
      status,
      durationOptionsMinutes: DEFAULT_MINUTES_OPTIONS,
      selectedDurationMinutes,
      remainingSeconds,
      startSession,
      resetSession,
      isSessionActive,
    }),
    [
      isSessionActive,
      remainingSeconds,
      resetSession,
      selectedDurationMinutes,
      startSession,
      status,
    ],
  );

  return (
    <PlaySessionContext.Provider value={value}>
      {children}
    </PlaySessionContext.Provider>
  );
}

export function usePlaySession() {
  const context = useContext(PlaySessionContext);
  if (!context) {
    throw new Error("usePlaySession must be used within PlaySessionProvider");
  }
  return context;
}
