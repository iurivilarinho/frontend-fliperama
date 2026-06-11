import { join } from "@tauri-apps/api/path";
import { exists, mkdir, writeFile, readTextFile } from "@tauri-apps/plugin-fs";
import { loadRuntimeIniConfig } from "./iniConfig";
import { getPlatformRuntimeConfig } from "./platformRuntimeConfig";

// Nome da plataforma (catálogo) -> pasta de sistema no servidor de thumbnails do
// libretro (thumbnails.libretro.com). Só sistemas com correspondência conhecida.
const LIBRETRO_SYSTEM: Record<string, string> = {
  "Nintendo Entertainment System": "Nintendo - Nintendo Entertainment System",
  "Super Nintendo Entertainment System":
    "Nintendo - Super Nintendo Entertainment System",
  "Nintendo 64": "Nintendo - Nintendo 64",
  "Nintendo Game Boy": "Nintendo - Game Boy",
  "Nintendo Game Boy Color": "Nintendo - Game Boy Color",
  "Nintendo Game Boy Advance": "Nintendo - Game Boy Advance",
  "Nintendo DS": "Nintendo - Nintendo DS",
  "Sega Genesis": "Sega - Mega Drive - Genesis",
  "Sega Master System": "Sega - Master System - Mark III",
  "Sega Game Gear": "Sega - Game Gear",
  "Sega 32X": "Sega - 32X",
  "SEGA CD": "Sega - Mega-CD - Sega CD",
  "Sega Dreamcast": "Sega - Dreamcast",
  "Sony PlayStation": "Sony - PlayStation",
  "NEC TurboGrafx-16": "NEC - PC Engine - TurboGrafx 16",
  "SNK Neo Geo Pocket Color": "SNK - Neo Geo Pocket Color",
  "Atari 2600": "Atari - 2600",
  "Atari 5200": "Atari - 5200",
  "Atari 7800": "Atari - 7800",
  "Atari Lynx": "Atari - Lynx",
  "Atari 8-bit": "Atari - 8-bit",
  ColecoVision: "Coleco - ColecoVision",
  "Commodore 64": "Commodore - 64",
  "Commodore Amiga": "Commodore - Amiga",
  "Panasonic 3DO": "The 3DO Company - 3DO",
  "Sega Naomi": "Sega - Naomi",
};

export function scraperSupportsPlatform(platformName: string): boolean {
  return Boolean(LIBRETRO_SYSTEM[platformName]);
}

export type ScrapeProgress = {
  total: number;
  done: number;
  found: number;
  current: string;
};

export type ScrapeResult = {
  total: number;
  boxarts: number;
  snaps: number;
  skipped: number;
};

// Regras de nome de arquivo do libretro: alguns caracteres viram "_".
function libretroFileName(name: string): string {
  return name.replace(/[&*/:`<>?\\|]/g, "_");
}

async function readDbGameNames(xmlPath: string): Promise<string[]> {
  if (!(await exists(xmlPath))) return [];
  const xml = await readTextFile(xmlPath);
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return [];
  return Array.from(doc.getElementsByTagName("game"))
    .map((g) => g.getAttribute("name")?.trim() ?? "")
    .filter(Boolean);
}

async function fetchAndSave(url: string, destPath: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (response.status !== 200) return false;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength < 200) return false; // resposta vazia/erro
    await writeFile(destPath, bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Baixa boxart (Wheel) e snap do servidor de thumbnails do libretro para os
 * jogos da plataforma, pulando os que já têm arte. Gratuito, sem chave de API.
 */
export async function scrapePlatformArt(
  platformName: string,
  onProgress?: (p: ScrapeProgress) => void,
): Promise<ScrapeResult> {
  const system = LIBRETRO_SYSTEM[platformName];
  if (!system) {
    return { total: 0, boxarts: 0, snaps: 0, skipped: 0 };
  }

  const ini = await loadRuntimeIniConfig();
  const cfg = await getPlatformRuntimeConfig(platformName);
  if (!cfg) return { total: 0, boxarts: 0, snaps: 0, skipped: 0 };

  const xmlPath = await join(
    ini.databasePath,
    cfg.databaseFolder,
    `${cfg.databaseFolder}.xml`,
  );
  const names = await readDbGameNames(xmlPath);

  const wheelDir = await join(
    ini.mediaBasePath,
    platformName,
    "Images",
    "Wheel",
  );
  const snapDir = await join(ini.mediaBasePath, platformName, "Images", "Snap");
  await mkdir(wheelDir, { recursive: true });
  await mkdir(snapDir, { recursive: true });

  const base = `https://thumbnails.libretro.com/${encodeURIComponent(system)}`;
  let boxarts = 0;
  let snaps = 0;
  let skipped = 0;
  let done = 0;

  for (const name of names) {
    const file = libretroFileName(name);
    const wheelPath = await join(wheelDir, `${name}.png`);
    const snapPath = await join(snapDir, `${name}.png`);

    if (await exists(wheelPath)) {
      skipped++;
    } else {
      const url = `${base}/Named_Boxarts/${encodeURIComponent(file)}.png`;
      if (await fetchAndSave(url, wheelPath)) boxarts++;
    }

    if (!(await exists(snapPath))) {
      const url = `${base}/Named_Snaps/${encodeURIComponent(file)}.png`;
      if (await fetchAndSave(url, snapPath)) snaps++;
    }

    done++;
    onProgress?.({ total: names.length, done, found: boxarts, current: name });
  }

  return { total: names.length, boxarts, snaps, skipped };
}
