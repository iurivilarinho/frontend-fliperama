import { appConfigDir, join } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";

type IniData = Record<string, Record<string, string>>;

function parseIni(text: string): IniData {
  const out: IniData = {};
  let section = "default";
  out[section] = {};

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;

    if (line.startsWith("[") && line.endsWith("]")) {
      section = line.slice(1, -1).trim() || "default";
      out[section] ??= {};
      continue;
    }

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();

    out[section] ??= {};
    out[section][key] = value;
  }

  return out;
}

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function ensureIni(): Promise<string> {
  const cfgDir = await appConfigDir();
  const iniPath = await join(cfgDir, "yt-overlay.ini");

  await mkdir(cfgDir, { recursive: true });

  const has = await exists(iniPath);
  if (!has) {
    const defaultIni = `; yt-overlay.ini

[runtime]
emulatorPath=
romsDir=
mediaBasePath=
databasePath=
themesBasePath=
acceptedRomExtensions=.zip,.7z
launchProfile=mame
`;
    await writeTextFile(iniPath, defaultIni);
  }

  return iniPath;
}

async function readIni(): Promise<{ iniPath: string; ini: IniData }> {
  const iniPath = await ensureIni();
  const iniText = await readTextFile(iniPath);
  return { iniPath, ini: parseIni(iniText) };
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

export async function loadRuntimeIniConfig(): Promise<RuntimeIniConfig> {
  const { iniPath, ini } = await readIni();

  const emulatorPath = (ini.runtime?.emulatorPath ?? "").trim();
  const romsDir = (ini.runtime?.romsDir ?? "").trim();
  const mediaBasePath = (ini.runtime?.mediaBasePath ?? "").trim();
  const databasePath = (ini.runtime?.databasePath ?? "").trim();
  const themesBasePath = (ini.runtime?.themesBasePath ?? "").trim();
  const acceptedRomExtensions = parseList(ini.runtime?.acceptedRomExtensions);
  const rawLaunchProfile = (ini.runtime?.launchProfile ?? "").trim();

  // hyperspinBasePath é a raiz da instalação do HyperSpin. Se não vier no ini,
  // derivamos da pasta pai de databasePath (ex.: ...\HyperSpin\Databases -> ...\HyperSpin).
  const hyperspinBasePath =
    (ini.runtime?.hyperspinBasePath ?? "").trim() ||
    (databasePath ? getParentDirectory(databasePath) : "");

  if (!emulatorPath) {
    throw new Error(
      `emulatorPath não configurado. Edite o arquivo:\n${iniPath}\n\n` +
        `Na seção [runtime], informe emulatorPath=...`,
    );
  }

  if (!romsDir) {
    throw new Error(
      `romsDir não configurado. Edite o arquivo:\n${iniPath}\n\n` +
        `Na seção [runtime], informe romsDir=...`,
    );
  }

  if (!mediaBasePath) {
    throw new Error(
      `mediaBasePath não configurado. Edite o arquivo:\n${iniPath}\n\n` +
        `Na seção [runtime], informe mediaBasePath=...`,
    );
  }

  if (!databasePath) {
    throw new Error(
      `databasePath não configurado. Edite o arquivo:\n${iniPath}\n\n` +
        `Na seção [runtime], informe databasePath=...`,
    );
  }

  if (!themesBasePath) {
    throw new Error(
      `themesBasePath não configurado. Edite o arquivo:\n${iniPath}\n\n` +
        `Na seção [runtime], informe themesBasePath=...`,
    );
  }

  if (acceptedRomExtensions.length === 0) {
    throw new Error(
      `acceptedRomExtensions não configurado. Edite o arquivo:\n${iniPath}\n\n` +
        `Na seção [runtime], informe acceptedRomExtensions=.zip,.7z`,
    );
  }

  if (rawLaunchProfile !== "mame") {
    throw new Error(
      `launchProfile inválido no arquivo:\n${iniPath}\n\n` +
        `Valor aceito atualmente: mame`,
    );
  }

  return {
    iniPath,
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