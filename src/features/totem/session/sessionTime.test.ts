import { describe, expect, it } from "vitest";
import {
  computeExpiresAt,
  isSessionExpired,
  parseStoredSession,
  remainingSecondsFrom,
  restoreSessionState,
} from "./sessionTime";

describe("computeExpiresAt", () => {
  it("soma os minutos em ms", () => {
    expect(computeExpiresAt(0, 5)).toBe(300_000);
    expect(computeExpiresAt(1_000, 1)).toBe(61_000);
  });
  it("trata minutos inválidos como zero", () => {
    expect(computeExpiresAt(1_000, -5)).toBe(1_000);
  });
});

describe("remainingSecondsFrom", () => {
  it("arredonda para cima quando há tempo restante", () => {
    expect(remainingSecondsFrom(10_500, 0)).toBe(11);
    expect(remainingSecondsFrom(300_000, 0)).toBe(300);
  });
  it("retorna 0 no instante da expiração ou depois", () => {
    expect(remainingSecondsFrom(1_000, 1_000)).toBe(0);
    expect(remainingSecondsFrom(1_000, 5_000)).toBe(0);
  });
});

describe("isSessionExpired", () => {
  it("verdadeiro quando agora >= expiração", () => {
    expect(isSessionExpired(1_000, 1_000)).toBe(true);
    expect(isSessionExpired(1_000, 2_000)).toBe(true);
  });
  it("falso quando ainda há tempo", () => {
    expect(isSessionExpired(2_000, 1_000)).toBe(false);
  });
});

describe("parseStoredSession", () => {
  it("retorna null para entrada vazia/ inválida", () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession("não-json")).toBeNull();
    expect(parseStoredSession("{}")).toBeNull();
    expect(
      parseStoredSession(JSON.stringify({ expiresAtMs: 1, durationMinutes: 0 })),
    ).toBeNull();
  });
  it("faz o parse de uma sessão válida", () => {
    const raw = JSON.stringify({
      expiresAtMs: 123,
      durationMinutes: 5,
      sessionId: 9,
    });
    expect(parseStoredSession(raw)).toEqual({
      expiresAtMs: 123,
      durationMinutes: 5,
      sessionId: 9,
    });
  });
  it("aceita sessão sem id (sessionId null)", () => {
    const raw = JSON.stringify({ expiresAtMs: 123, durationMinutes: 5 });
    expect(parseStoredSession(raw)?.sessionId).toBeNull();
  });
});

describe("restoreSessionState", () => {
  it("idle quando não há sessão", () => {
    expect(restoreSessionState(null, 1_000).status).toBe("idle");
  });
  it("active quando ainda há tempo (sobrevive a refresh)", () => {
    const state = restoreSessionState(
      { expiresAtMs: 60_000, durationMinutes: 1, sessionId: 7 },
      30_000,
    );
    expect(state.status).toBe("active");
    expect(state.remainingSeconds).toBe(30);
    expect(state.sessionId).toBe(7);
  });
  it("expired quando o tempo já passou", () => {
    const state = restoreSessionState(
      { expiresAtMs: 10_000, durationMinutes: 1 },
      20_000,
    );
    expect(state.status).toBe("expired");
    expect(state.remainingSeconds).toBe(0);
  });
});
