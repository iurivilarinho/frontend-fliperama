import {
  getAllRuntimeConfig,
  migrateIniToDbIfNeeded,
} from "./runtimeConfig";

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export type PlatformLaunchProfile = "mame";

export type RuntimeIniConfig = {
  iniPath: string;
  hyperspinBasePath: string;
  emulatorPath: string;
  romsDir: string;
  mediaBasePath: string;
  databasePath: string;
  themesBasePath: string;
  acceptedRomExtensions: string[];
  launchProfile: PlatformLaunchProfile;
};

function getParentDirectory(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return normalized;
  return normalized.slice(0, index).replaceAll("/", "\\");
}

const CONFIG_HINT =
  "Configure em Configurações no painel admin (Ctrl+Shift+A).";

export async function loadRuntimeIniConfig(): Promise<RuntimeIniConfig> {
  // Migra valores do .ini legado para o banco na primeira vez (se houver).
  await migrateIniToDbIfNeeded();
  const cfg = await getAllRuntimeConfig();

  const emulatorPath = cfg.emulatorPath.trim();
  const romsDir = cfg.romsDir.trim();
  const mediaBasePath = cfg.mediaBasePath.trim();
  const databasePath = cfg.databasePath.trim();
  const themesBasePath = cfg.themesBasePath.trim();
  const acceptedRomExtensions = parseList(cfg.acceptedRomExtensions);

  // hyperspinBasePath é a raiz dos dados. Se não vier configurado, derivamos da
  // pasta pai de databasePath (ex.: ...\fliperama-data\Databases -> ...\fliperama-data).
  const hyperspinBasePath =
    cfg.hyperspinBasePath.trim() ||
    (databasePath ? getParentDirectory(databasePath) : "");

  if (!emulatorPath) {
    throw new Error(`Caminho do emulador (MAME) não configurado. ${CONFIG_HINT}`);
  }
  if (!romsDir) {
    throw new Error(`Pasta de ROMs não configurada. ${CONFIG_HINT}`);
  }
  if (!mediaBasePath) {
    throw new Error(`Pasta de mídia não configurada. ${CONFIG_HINT}`);
  }
  if (!databasePath) {
    throw new Error(`Pasta de banco de dados não configurada. ${CONFIG_HINT}`);
  }
  if (!themesBasePath) {
    throw new Error(`Pasta de temas não configurada. ${CONFIG_HINT}`);
  }
  if (acceptedRomExtensions.length === 0) {
    throw new Error(`Extensões de ROM não configuradas. ${CONFIG_HINT}`);
  }

  return {
    iniPath: CONFIG_HINT,
    hyperspinBasePath,
    emulatorPath,
    romsDir,
    mediaBasePath,
    databasePath,
    themesBasePath,
    acceptedRomExtensions,
    launchProfile: "mame",
  };
}