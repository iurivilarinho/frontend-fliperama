import { execute, select } from "./client";
import { sha256Hex as computeSha256 } from "../sha256";

const ADMIN_PASSWORD_KEY = "admin_password_sha256";

export async function getSetting(key: string): Promise<string | null> {
  const rows = await select<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await execute(
    "INSERT INTO settings (key, value) VALUES (?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}

// SHA-256 em JS puro (services/sha256). NÃO usa crypto.subtle, que só existe em
// contexto seguro (HTTPS/localhost) — no acesso remoto via http://<ip> ele é
// undefined e quebrava o login ("banco indisponível").
async function sha256Hex(text: string): Promise<string> {
  return computeSha256(text);
}

/** Se já existe uma senha de admin definida (primeira execução define uma). */
export async function hasAdminPassword(): Promise<boolean> {
  try {
    return Boolean(await getSetting(ADMIN_PASSWORD_KEY));
  } catch {
    return false;
  }
}

/**
 * Verifica a senha do admin. Sem senha definida (primeira vez), retorna false —
 * a interface mostra o cadastro inicial em vez de logar com padrão.
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const stored = await getSetting(ADMIN_PASSWORD_KEY);
  if (!stored) return false;
  return (await sha256Hex(password)) === stored;
}

export async function setAdminPassword(newPassword: string): Promise<void> {
  const hash = await sha256Hex(newPassword);
  await setSetting(ADMIN_PASSWORD_KEY, hash);
}

/** Remove a senha do admin (usado pelo reset por arquivo). Volta pro cadastro. */
export async function clearAdminPassword(): Promise<void> {
  await execute("DELETE FROM settings WHERE key = ?", [ADMIN_PASSWORD_KEY]);
}

const SHOW_WITHOUT_ROMS_KEY = "show_without_roms";

/** Se true, a interface mostra jogos mesmo sem ROM no disco. Padrão: false. */
export async function getShowWithoutRoms(): Promise<boolean> {
  try {
    return (await getSetting(SHOW_WITHOUT_ROMS_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function setShowWithoutRoms(value: boolean): Promise<void> {
  await setSetting(SHOW_WITHOUT_ROMS_KEY, value ? "true" : "false");
}

const PAYMENT_ENABLED_KEY = "payment_enabled";

/**
 * Se true (padrão), o totem cobra: mostra a tela de pagamento (PIX) e a sessão é
 * por tempo. Se false (modo livre/pacote mensal), pula o pagamento e a máquina
 * fica liberada para jogar sem tempo.
 */
export async function getPaymentEnabled(): Promise<boolean> {
  try {
    return (await getSetting(PAYMENT_ENABLED_KEY)) !== "false";
  } catch {
    return true;
  }
}

export async function setPaymentEnabled(value: boolean): Promise<void> {
  await setSetting(PAYMENT_ENABLED_KEY, value ? "true" : "false");
}

const CRT_SHADER_KEY = "crt_shader_enabled";

/** Liga o shader CRT (scanlines/curvatura) nos jogos via RetroArch. Padrão: off. */
export async function getCrtShaderEnabled(): Promise<boolean> {
  try {
    return (await getSetting(CRT_SHADER_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function setCrtShaderEnabled(value: boolean): Promise<void> {
  await setSetting(CRT_SHADER_KEY, value ? "true" : "false");
}

const BEZEL_KEY = "bezel_enabled";

/** Liga a moldura (bezel) em volta do jogo no RetroArch. Padrão: off. */
export async function getBezelEnabled(): Promise<boolean> {
  try {
    return (await getSetting(BEZEL_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function setBezelEnabled(value: boolean): Promise<void> {
  await setSetting(BEZEL_KEY, value ? "true" : "false");
}
