import { join } from "@tauri-apps/api/path";
import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import { loadRuntimeIniConfig } from "./iniConfig";

/**
 * Perfis de execução suportados.
 * - "mame": MAME e variantes (Neo Geo via mame.exe). Recebe o shortname da ROM
 *   e a pasta de ROMs (mame.exe -rompath ... <shortname>).
 * - "generic": emuladores que recebem o caminho absoluto da ROM como argumento
 *   (Project64, Nestopia, ZSNES, Kega Fusion, etc.).
 * - "retroarch": RetroArch com core libretro
 *   (retroarch.exe -L <core> <rom>).
 */
export type LaunchProfile = "mame" | "generic" | "retroarch";

export type PlatformCatalogEntry = {
  /**
   * Nome da pasta dentro de Databases. Por padrão usamos o nome da plataforma
   * (igual ao tema). Só preencha quando o banco estiver numa pasta com nome
   * diferente do tema.
   */
  databaseFolder?: string;
  /** Caminho da pasta de ROMs relativo à raiz do HyperSpin. */
  romsRelativePath: string;
  /** Caminho do executável do emulador relativo à raiz do HyperSpin. */
  emulatorRelativePath: string;
  /**
   * Caminho do core libretro (.dll) relativo à raiz do HyperSpin.
   * Obrigatório para launchProfile "retroarch".
   */
  coreRelativePath?: string;
  /**
   * Argumentos extras passados ANTES do caminho da ROM no perfil "generic"
   * (ex.: PCSX2 ["-batch","-fullscreen"], RPCS3 ["--no-gui"]). Útil para
   * emuladores standalone abrirem em tela cheia / sem GUI.
   */
  launchArgs?: string[];
  launchProfile: LaunchProfile;
  /** Extensões de ROM aceitas para esta plataforma. */
  romExtensions: string[];
};

const RA_EXE = "Emulators/RetroArch/retroarch.exe";
const RA_CORE = (core: string) => `Emulators/RetroArch/cores/${core}_libretro.dll`;
const RA_ROMS = (platform: string) => `Emulators/RetroArch/roms/${platform}`;

/**
 * Mapeia cada plataforma (nome do tema em Media/main_menu/Themes) para o
 * emulador, pasta de ROMs e banco de dados correspondentes na instalação do
 * HyperSpin. Plataformas sem entrada aqui ainda aparecem no menu, mas não
 * listam jogos (sem ROMs/emulador configurados).
 */
export const PLATFORM_CATALOG: Record<string, PlatformCatalogEntry> = {
  MAME: {
    romsRelativePath: "Emulators/MAME/roms",
    emulatorRelativePath: "Emulators/MAME/mame.exe",
    launchProfile: "mame",
    romExtensions: [".zip", ".7z"],
  },
  "SNK Neo Geo": {
    // O tema chama "SNK Neo Geo", mas o emulador/ROMs ficam em "Neo Geo".
    romsRelativePath: "Emulators/Neo Geo/roms",
    emulatorRelativePath: "Emulators/Neo Geo/mame.exe",
    launchProfile: "mame",
    romExtensions: [".zip", ".7z"],
  },
  "Nintendo 64": {
    romsRelativePath: "Emulators/Nintendo 64/Roms",
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("mupen64plus_next"),
    launchProfile: "retroarch",
    romExtensions: [".z64", ".n64", ".v64", ".zip"],
  },
  "Nintendo Entertainment System": {
    romsRelativePath: "Emulators/Nintendo Entertainment System/Roms",
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("fceumm"),
    launchProfile: "retroarch",
    romExtensions: [".nes", ".zip"],
  },
  "Super Nintendo Entertainment System": {
    romsRelativePath: "Emulators/Super Nintendo Entertainment System/roms",
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("snes9x"),
    launchProfile: "retroarch",
    romExtensions: [".smc", ".sfc", ".zip"],
  },
  "Sega Genesis": {
    romsRelativePath: "Emulators/Sega/roms megadrive",
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("genesis_plus_gx"),
    launchProfile: "retroarch",
    romExtensions: [".md", ".bin", ".gen", ".smd", ".zip"],
  },
  "Sega Master System": {
    romsRelativePath: "Emulators/Sega/roms master system",
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("genesis_plus_gx"),
    launchProfile: "retroarch",
    romExtensions: [".sms", ".zip"],
  },
  "Sega 32X": {
    romsRelativePath: "Emulators/Sega/roms Sega32x",
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("picodrive"),
    launchProfile: "retroarch",
    romExtensions: [".32x", ".bin", ".zip"],
  },

  // ── Plataformas via RetroArch (cores libretro) ──
  // ROMs ficam em Emulators/RetroArch/roms/<plataforma> (pastas criadas vazias;
  // basta o usuário soltar as ROMs e os jogos aparecem).
  "Nintendo Game Boy Advance": {
    romsRelativePath: RA_ROMS("Nintendo Game Boy Advance"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("mgba"),
    launchProfile: "retroarch",
    romExtensions: [".gba", ".zip"],
  },
  "NEC TurboGrafx-16": {
    romsRelativePath: RA_ROMS("NEC TurboGrafx-16"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("mednafen_pce_fast"),
    launchProfile: "retroarch",
    romExtensions: [".pce", ".zip", ".cue", ".chd"],
  },
  "Sega Game Gear": {
    romsRelativePath: RA_ROMS("Sega Game Gear"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("genesis_plus_gx"),
    launchProfile: "retroarch",
    romExtensions: [".gg", ".zip", ".sms"],
  },
  "SNK Neo Geo Pocket Color": {
    romsRelativePath: RA_ROMS("SNK Neo Geo Pocket Color"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("mednafen_ngp"),
    launchProfile: "retroarch",
    romExtensions: [".ngp", ".ngc", ".zip"],
  },
  "Panasonic 3DO": {
    romsRelativePath: RA_ROMS("Panasonic 3DO"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("opera"),
    launchProfile: "retroarch",
    romExtensions: [".iso", ".cue", ".chd"],
  },
  "Sega Dreamcast": {
    romsRelativePath: RA_ROMS("Sega Dreamcast"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("flycast"),
    launchProfile: "retroarch",
    romExtensions: [".gdi", ".chd", ".cue", ".cdi"],
  },
  "Sony PlayStation": {
    romsRelativePath: RA_ROMS("Sony PlayStation"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("mednafen_psx_hw"),
    launchProfile: "retroarch",
    romExtensions: [".cue", ".chd", ".pbp", ".m3u"],
  },
  "Atari Lynx": {
    romsRelativePath: RA_ROMS("Atari Lynx"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("handy"),
    launchProfile: "retroarch",
    romExtensions: [".lnx", ".zip"],
  },
  "Atari 5200": {
    romsRelativePath: RA_ROMS("Atari 5200"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("a5200"),
    launchProfile: "retroarch",
    romExtensions: [".a52", ".bin", ".zip"],
  },
  "SEGA CD": {
    romsRelativePath: RA_ROMS("SEGA CD"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("genesis_plus_gx"),
    launchProfile: "retroarch",
    romExtensions: [".cue", ".chd", ".iso"],
  },

  // ── Sistemas adicionados do pack HyperSpin AIO (RetroArch) ──
  "Atari 2600": {
    romsRelativePath: RA_ROMS("Atari 2600"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("stella"),
    launchProfile: "retroarch",
    romExtensions: [".a26", ".bin", ".zip"],
  },
  "Atari 8-bit": {
    romsRelativePath: RA_ROMS("Atari 8-bit"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("atari800"),
    launchProfile: "retroarch",
    romExtensions: [".atr", ".xex", ".bin", ".car", ".zip"],
  },
  ColecoVision: {
    romsRelativePath: RA_ROMS("ColecoVision"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("gearcoleco"),
    launchProfile: "retroarch",
    romExtensions: [".col", ".bin", ".rom", ".zip"],
  },
  "Commodore 64": {
    romsRelativePath: RA_ROMS("Commodore 64"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("vice_x64"),
    launchProfile: "retroarch",
    romExtensions: [".d64", ".t64", ".prg", ".crt", ".zip"],
  },
  "Commodore Amiga": {
    romsRelativePath: RA_ROMS("Commodore Amiga"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("puae"),
    launchProfile: "retroarch",
    romExtensions: [".adf", ".hdf", ".lha", ".uae", ".ipf", ".zip"],
  },
  Doom: {
    romsRelativePath: RA_ROMS("Doom"),
    emulatorRelativePath: RA_EXE,
    coreRelativePath: RA_CORE("prboom"),
    launchProfile: "retroarch",
    romExtensions: [".wad", ".iwad", ".pwad", ".zip"],
  },
};

export type ResolvedPlatformConfig = {
  platformName: string;
  databaseFolder: string;
  romsDir: string;
  emulatorPath: string;
  corePath: string | null;
  launchArgs: string[];
  launchProfile: LaunchProfile;
  romExtensions: string[];
};

// Plataformas adicionadas dinamicamente (ex.: integração do pack AIO) ficam
// num JSON na raiz do HyperSpin, pra entrar sem mexer no código.
let aioCache: Record<string, PlatformCatalogEntry> | null = null;

export async function getAioPlatforms(): Promise<
  Record<string, PlatformCatalogEntry>
> {
  if (aioCache) return aioCache;
  try {
    const ini = await loadRuntimeIniConfig();
    const jsonPath = await join(ini.hyperspinBasePath, "_aio_platforms.json");
    if (await exists(jsonPath)) {
      aioCache = JSON.parse(await readTextFile(jsonPath));
    } else {
      aioCache = {};
    }
  } catch {
    aioCache = {};
  }
  return aioCache ?? {};
}

export async function getPlatformCatalogEntry(
  platformName: string,
): Promise<PlatformCatalogEntry | null> {
  if (PLATFORM_CATALOG[platformName]) return PLATFORM_CATALOG[platformName];
  const aio = await getAioPlatforms();
  return aio[platformName] ?? null;
}

export async function listCatalogPlatformNames(): Promise<string[]> {
  const aio = await getAioPlatforms();
  return [...new Set([...Object.keys(PLATFORM_CATALOG), ...Object.keys(aio)])];
}

/**
 * Resolve os caminhos absolutos de uma plataforma a partir da raiz do
 * HyperSpin. Retorna null quando a plataforma não está no catálogo (sem
 * emulador/ROMs conhecidos).
 */
export async function resolvePlatformConfig(
  hyperspinBasePath: string,
  platformName: string,
): Promise<ResolvedPlatformConfig | null> {
  const entry = await getPlatformCatalogEntry(platformName);
  if (!entry) return null;

  const romsDir = await join(hyperspinBasePath, entry.romsRelativePath);
  const emulatorPath = await join(
    hyperspinBasePath,
    entry.emulatorRelativePath,
  );
  const corePath = entry.coreRelativePath
    ? await join(hyperspinBasePath, entry.coreRelativePath)
    : null;

  return {
    platformName,
    databaseFolder: entry.databaseFolder ?? platformName,
    romsDir,
    emulatorPath,
    corePath,
    launchArgs: entry.launchArgs ?? [],
    launchProfile: entry.launchProfile,
    romExtensions: entry.romExtensions,
  };
}
