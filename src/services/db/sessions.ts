import { execute } from "./client";

/**
 * Cria a sessão e (opcionalmente) registra o pagamento associado.
 * Retorna o id da sessão, ou null se o banco não estiver disponível.
 */
export async function createSession(params: {
  durationMinutes: number;
  expiresAtMs: number;
  payment?: {
    amountCents: number;
    providerId?: string | null;
    status?: string; // approved (padrão)
  } | null;
}): Promise<number | null> {
  try {
    const startedAt = new Date().toISOString();
    const expiresAt = new Date(params.expiresAtMs).toISOString();

    const res = await execute(
      "INSERT INTO sessions (started_at, duration_minutes, status, expires_at) VALUES (?, ?, 'active', ?)",
      [startedAt, params.durationMinutes, expiresAt],
    );
    const sessionId = res.lastInsertId ?? null;

    if (params.payment && sessionId != null) {
      await execute(
        "INSERT INTO payments (session_id, provider_id, amount_cents, minutes, status, created_at, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          sessionId,
          params.payment.providerId ?? null,
          params.payment.amountCents,
          params.durationMinutes,
          params.payment.status ?? "approved",
          startedAt,
          startedAt,
        ],
      );
    }

    return sessionId;
  } catch (error) {
    console.warn("DB indisponível ao criar sessão:", error);
    return null;
  }
}

export async function markSessionStatus(
  sessionId: number | null,
  status: "ended" | "expired",
): Promise<void> {
  if (sessionId == null) return;
  try {
    await execute(
      "UPDATE sessions SET status = ?, ended_at = ? WHERE id = ? AND status = 'active'",
      [status, new Date().toISOString(), sessionId],
    );
  } catch (error) {
    console.warn("DB indisponível ao encerrar sessão:", error);
  }
}

/** Encerra qualquer sessão que ficou 'active' além do tempo (limpeza no boot). */
export async function expireStaleSessions(): Promise<void> {
  try {
    await execute(
      "UPDATE sessions SET status = 'expired', ended_at = COALESCE(ended_at, ?) WHERE status = 'active' AND expires_at < ?",
      [new Date().toISOString(), new Date().toISOString()],
    );
  } catch {
    // ignore
  }
}
