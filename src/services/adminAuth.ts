import { join } from "@tauri-apps/api/path";
import { exists, remove } from "@tauri-apps/plugin-fs";
import { getRuntimeConfigValue } from "./runtimeConfig";
import { clearAdminPassword } from "./db/settings";

const RESET_FILENAME = "resetar-senha-admin.txt";

/**
 * Recuperação de senha esquecida: se existir o arquivo
 * `<raiz dos dados>/resetar-senha-admin.txt`, apaga a senha do admin (volta para
 * o cadastro inicial) e remove o arquivo. Assim o operador nunca perde o acesso.
 * Rodado ao abrir o painel. Retorna true se resetou.
 */
export async function maybeResetAdminPassword(): Promise<boolean> {
  try {
    const base = (await getRuntimeConfigValue("hyperspinBasePath")).trim();
    if (!base) return false;
    const resetFile = await join(base, RESET_FILENAME);
    if (await exists(resetFile)) {
      await clearAdminPassword();
      await remove(resetFile).catch(() => {});
      return true;
    }
  } catch {
    // sem base/arquivo: ignora
  }
  return false;
}

export { RESET_FILENAME };
