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
