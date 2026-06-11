/* eslint-disable react-refresh/only-export-components */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
import { getPaymentEnabled } from "../../../services/db/settings";

const DEFAULT_MINUTES_OPTIONS = [5, 10, 15] as const;
const SESSION_STORAGE_KEY = "arcade-play-session";

// Fora do Tauri (navegador remoto acessando o painel pela rede) as APIs de
// janela/overlay/timer não existem — chamá-las quebra a tela. Guardamos com isto.
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

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
  /** Modo livre: pagamento desligado (pacote mensal) — máquina liberada. */
  freeMode: boolean;
  /** Pode jogar: sessão paga ativa OU modo livre. */
  canPlay: boolean;
};

const PlaySessionContext = createContext<PlaySessionContextValue | null>(null);

async function pinMiniOverlayWindow() {
  if (!isTauri) return;
  await invoke("ensure_overlay_mini_window");
  const overlayMini = await WebviewWindow.getByLabel("overlay_mini");
  if (!overlayMini) return;
  await overlayMini.setAlwaysOnTop(true);
  await overlayMini.show();
  await overlayMini.unminimize();
}

async function closeMiniOverlayWindow() {
  if (!isTauri) return;
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

  // Modo livre (pagamento desligado no admin). Recarrega quando muda no painel.
  const [freeMode, setFreeMode] = useState(false);
  useEffect(() => {
    if (isMiniOverlayWindow) return;
    const reload = () => {
      getPaymentEnabled()
        .then((enabled) => setFreeMode(!enabled))
        .catch(() => {});
    };
    reload();
    window.addEventListener("payment-config-updated", reload);
    return () => window.removeEventListener("payment-config-updated", reload);
  }, [isMiniOverlayWindow]);

  const isSessionActive = status === "active" && remainingSeconds > 0;
  // No modo livre a máquina fica liberada (sem pagamento/tempo).
  const canPlay = isSessionActive || freeMode;

  // Limpa no boot quaisquer sessões que ficaram "active" além do tempo.
  useEffect(() => {
    if (isMiniOverlayWindow) return;
    void expireStaleSessions();
    // Se o estado restaurado já está expirado, garante limpeza.
    if (initial.status === "expired") {
      clearPersistedSession();
    }
    // Após refresh/reconexão com sessão ativa, reagenda o timer garantido.
    if (isTauri && initial.status === "active" && initial.remainingSeconds > 0) {
      void invoke("start_session_timer", {
        remainingSecs: initial.remainingSeconds,
      }).catch(() => {});
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

      // Timer garantido no backend (Rust): encerra o emulador no horário exato,
      // mesmo se o app perder o foco e o timer do webview for estrangulado.
      if (isTauri) {
        void invoke("start_session_timer", {
          remainingSecs: minutes * 60,
        }).catch(() => {});
      }

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
    if (isTauri) void invoke("cancel_session_timer").catch(() => {});
    setStatus("idle");
    setRemainingSeconds(0);
    setSelectedDurationMinutes(null);
    expiresAtRef.current = null;
    sessionIdRef.current = null;
    clearPersistedSession();
  }, [status]);

  // Encerramento da sessão (zerou o tempo). Idempotente: usa expiresAtRef como
  // trava para não rodar duas vezes (tick do webview + evento do Rust).
  const handleExpiry = useCallback(() => {
    if (expiresAtRef.current == null) return;
    expiresAtRef.current = null;
    setStatus("expired");
    setRemainingSeconds(0);
    void markSessionStatus(sessionIdRef.current, "expired");
    if (isTauri) void backupSaves();
    clearPersistedSession();
  }, []);

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
        handleExpiry();
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [isMiniOverlayWindow, status, handleExpiry]);

  // Evento do backend (Rust): a sessão expirou e o emulador já foi encerrado.
  // Garante o redirecionamento ao pagamento mesmo se o timer do webview falhar.
  useEffect(() => {
    if (isMiniOverlayWindow) return;

    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    listen("session-expired", () => {
      handleExpiry();
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, [isMiniOverlayWindow, handleExpiry]);

  useEffect(() => {
    if (isMiniOverlayWindow) return;
    if (isSessionActive) {
      pinMiniOverlayWindow().catch(() => {});
      return;
    }
    closeMiniOverlayWindow().catch(() => {});
  }, [isMiniOverlayWindow, isSessionActive]);

  useEffect(() => {
    if (isMiniOverlayWindow || !isTauri) return;
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
      freeMode,
      canPlay,
    }),
    [
      canPlay,
      freeMode,
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
