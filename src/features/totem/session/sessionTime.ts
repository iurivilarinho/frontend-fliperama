// Lógica pura de tempo de sessão — sem dependência de React/DOM/Tauri, para
// ser facilmente testável e usada como fonte da verdade do controle de tempo.

export type SessionStatus = "idle" | "active" | "expired";

export type StoredSession = {
  expiresAtMs: number;
  durationMinutes: number;
  sessionId?: number | null;
};

export type RestoredState = {
  status: SessionStatus;
  remainingSeconds: number;
  durationMinutes: number | null;
  expiresAtMs: number | null;
  sessionId: number | null;
};

const IDLE_STATE: RestoredState = {
  status: "idle",
  remainingSeconds: 0,
  durationMinutes: null,
  expiresAtMs: null,
  sessionId: null,
};

export function computeExpiresAt(startMs: number, minutes: number): number {
  return startMs + Math.max(0, Math.floor(minutes)) * 60_000;
}

/** Segundos restantes (>= 0), arredondando para cima. */
export function remainingSecondsFrom(
  expiresAtMs: number,
  nowMs: number,
): number {
  const diff = expiresAtMs - nowMs;
  if (diff <= 0) return 0;
  return Math.ceil(diff / 1000);
}

export function isSessionExpired(expiresAtMs: number, nowMs: number): boolean {
  return nowMs >= expiresAtMs;
}

export function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof data?.expiresAtMs !== "number" ||
      typeof data?.durationMinutes !== "number" ||
      !Number.isFinite(data.expiresAtMs) ||
      data.durationMinutes <= 0
    ) {
      return null;
    }
    return {
      expiresAtMs: data.expiresAtMs,
      durationMinutes: data.durationMinutes,
      sessionId:
        typeof data.sessionId === "number" ? data.sessionId : null,
    };
  } catch {
    return null;
  }
}

/**
 * Restaura o estado da sessão a partir do que foi persistido. Sobrevive a
 * refresh/reconexão porque usa um timestamp absoluto de expiração.
 */
export function restoreSessionState(
  stored: StoredSession | null,
  nowMs: number,
): RestoredState {
  if (!stored) return IDLE_STATE;

  if (isSessionExpired(stored.expiresAtMs, nowMs)) {
    return {
      status: "expired",
      remainingSeconds: 0,
      durationMinutes: stored.durationMinutes,
      expiresAtMs: stored.expiresAtMs,
      sessionId: stored.sessionId ?? null,
    };
  }

  return {
    status: "active",
    remainingSeconds: remainingSecondsFrom(stored.expiresAtMs, nowMs),
    durationMinutes: stored.durationMinutes,
    expiresAtMs: stored.expiresAtMs,
    sessionId: stored.sessionId ?? null,
  };
}
