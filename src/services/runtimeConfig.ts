import { appConfigDir, join } from "@tauri-apps/api/path";
import { exists, readTextFile, remove } from "@tauri-apps/plugin-fs";
import { getSetting, setSetting } from "./db/settings";

/**
 * Configuração de runtime do totem. Antes vivia num arquivo .ini
 * (`%APPDATA%\com.lis.fliperama\yt-overlay.ini`); agora fica na tabela
 * `settings` do SQLite e é editável pela tela de Configurações do painel.
 */
export const RUNTIME_CONFIG_KEYS = [
  "hyperspinBasePath",
  "emulatorPath",
  "romsDir",
  "mediaBasePath",
  "databasePath",
  "themesBasePath",
  "acceptedRomExtensions",
  "mercadoPagoToken",
] as const;

export type RuntimeConfigKey = (typeof RUNTIME_CONFIG_KEYS)[number];

const PREFIX = "cfg_";

export async function getRuntimeConfigValue(
  key: RuntimeConfigKey,
): Promise<string> {
  return (await getSetting(PREFIX + key)) ?? "";
}

export async function setRuntimeConfigValue(
  key: RuntimeConfigKey,
  value: string,
): Promise<void> {
  await setSetting(PREFIX + key, value.trim());
}

export async function getAllRuntimeConfig(): Promise<
  Record<RuntimeConfigKey, string>
> {
  const out = {} as Record<RuntimeConfigKey, string>;
  for (const key of RUNTIME_CONFIG_KEYS) {
    out[key] = (await getSetting(PREFIX + key)) ?? "";
  }
  return out;
}

/** Token de acesso do Mercado Pago (pagamentos PIX). */
export async function getMercadoPagoToken(): Promise<string> {
  return getRuntimeConfigValue("mercadoPagoToken");
}

// Migração única do .ini legado para o banco. Roda uma vez por sessão; se o
// banco já tem config (ou não há .ini), não faz nada. Após migrar, apaga o .ini.
// Guardamos a PROMISE (não um boolean): assim chamadas concorrentes na inicialização
// aguardam a MESMA migração terminar antes de ler a config — evita a corrida em que
// alguém lê o banco ainda vazio e acha que nada está configurado.
let migrationPromise: Promise<void> | null = null;

export async function migrateIniToDbIfNeeded(): Promise<void> {
  if (!migrationPromise) migrationPromise = runMigration();
  return migrationPromise;
}

async function runMigration(): Promise<void> {
  try {
    // Se já houver caminho base no banco, consideramos configurado.
    if (await getSetting(PREFIX + "hyperspinBasePath")) return;

    const iniPath = await join(await appConfigDir(), "yt-overlay.ini");
    if (!(await exists(iniPath))) return;

    const text = await readTextFile(iniPath);
    const map: Record<string, string> = {};
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (
        !line ||
        line.startsWith(";") ||
        line.startsWith("#") ||
        line.startsWith("[")
      ) {
        continue;
      }
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      map[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }

    for (const key of RUNTIME_CONFIG_KEYS) {
      if (map[key]) await setSetting(PREFIX + key, map[key]);
    }

    // .ini morto: o banco passa a ser a fonte da verdade.
    try {
      await remove(iniPath);
    } catch {
      // sem permissão para apagar: tudo bem, paramos de ler ele de qualquer forma.
    }
  } catch {
    // Sem .ini ou falha de leitura: o usuário configura pela interface.
  }
}
