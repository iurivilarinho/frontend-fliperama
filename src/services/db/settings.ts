import { execute, select } from "./client";

const ADMIN_PASSWORD_KEY = "admin_password_sha256";
const DEFAULT_ADMIN_PASSWORD = "admin";

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

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verifica a senha do admin. Na primeira vez (sem senha cadastrada), usa a
 * senha padrão "admin" e a grava.
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  let stored = await getSetting(ADMIN_PASSWORD_KEY);

  if (!stored) {
    stored = await sha256Hex(DEFAULT_ADMIN_PASSWORD);
    await setSetting(ADMIN_PASSWORD_KEY, stored);
  }

  const incoming = await sha256Hex(password);
  return incoming === stored;
}

export async function setAdminPassword(newPassword: string): Promise<void> {
  const hash = await sha256Hex(newPassword);
  await setSetting(ADMIN_PASSWORD_KEY, hash);
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
