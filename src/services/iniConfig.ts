import {
  getAllRuntimeConfig,
  migrateIniToDbIfNeeded,
} from "./runtimeConfig";

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

  // hyperspinBasePath é a raiz dos dados (ÚNICO caminho que o usuário informa).
  // Se não vier, derivamos da pasta pai de um databasePath legado.
  const hyperspinBasePath =
    cfg.hyperspinBasePath.trim() ||
    (cfg.databasePath?.trim()
      ? getParentDirectory(cfg.databasePath.trim())
      : "");

  if (!hyperspinBasePath) {
    throw new Error(`Pasta raiz dos dados não configurada. ${CONFIG_HINT}`);
  }

  // Tudo abaixo é DERIVADO da raiz (não precisa de parâmetro próprio). Mantemos o
  // valor do banco se existir (compatibilidade), senão montamos a partir da raiz.
  const databasePath =
    cfg.databasePath?.trim() || `${hyperspinBasePath}\\Databases`;
  const mediaBasePath = cfg.mediaBasePath?.trim() || `${hyperspinBasePath}\\Media`;
  const themesBasePath =
    cfg.themesBasePath?.trim() || `${hyperspinBasePath}\\Media`;
  const emulatorPath = `${hyperspinBasePath}\\Emulators\\MAME\\mame.exe`;
  const romsDir = `${hyperspinBasePath}\\Emulators\\MAME\\roms`;
  const acceptedRomExtensions = [".zip", ".7z"];

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