import { join } from "@tauri-apps/api/path";
import { exists, readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { loadRuntimeIniConfig } from "./iniConfig";
import {
  listCatalogPlatformNames,
  resolvePlatformConfig,
} from "./platformCatalog";

export type PlatformReconciliation = {
  platform: string;
  romsCount: number; // arquivos de ROM no disco
  gamesCount: number; // jogos no banco (XML)
  matched: number; // jogos com ROM
  missingRoms: string[]; // jogos do banco sem arquivo de ROM
  orphanRoms: string[]; // arquivos de ROM sem jogo no banco
  occupancyPct: number; // matched / gamesCount
};

export type LibraryReport = {
  platforms: PlatformReconciliation[];
  totals: {
    games: number;
    roms: number;
    matched: number;
    missing: number;
    orphans: number;
    occupancyPct: number;
  };
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function removeExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/i, "");
}

async function readRomBaseNames(
  romsDir: string,
  extensions: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!(await exists(romsDir))) return map;

  const entries = await readDir(romsDir);
  for (const entry of entries) {
    if (!entry.isFile || !entry.name) continue;
    const lower = entry.name.toLowerCase();
    if (!extensions.some((e) => lower.endsWith(e))) continue;
    const base = removeExtension(entry.name);
    map.set(normalizeKey(base), entry.name);
  }
  return map;
}

async function readDbGameNames(xmlPath: string): Promise<string[]> {
  if (!(await exists(xmlPath))) return [];
  const xml = await readTextFile(xmlPath);
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return [];
  return Array.from(doc.getElementsByTagName("game"))
    .map((g) => g.getAttribute("name")?.trim() ?? "")
    .filter(Boolean);
}

export async function reconcilePlatform(
  platformName: string,
): Promise<PlatformReconciliation | null> {
  const ini = await loadRuntimeIniConfig();
  const cfg = await resolvePlatformConfig(ini.hyperspinBasePath, platformName);
  if (!cfg) return null;

  const xmlPath = await join(
    ini.databasePath,
    cfg.databaseFolder,
    `${cfg.databaseFolder}.xml`,
  );

  const [romMap, gameNames] = await Promise.all([
    readRomBaseNames(cfg.romsDir, cfg.romExtensions),
    readDbGameNames(xmlPath),
  ]);

  const gameKeys = new Set(gameNames.map(normalizeKey));

  const missingRoms: string[] = [];
  let matched = 0;
  for (const name of gameNames) {
    if (romMap.has(normalizeKey(name))) matched += 1;
    else missingRoms.push(name);
  }

  const orphanRoms: string[] = [];
  for (const [key, fileName] of romMap) {
    if (!gameKeys.has(key)) orphanRoms.push(fileName);
  }

  const gamesCount = gameNames.length;
  return {
    platform: platformName,
    romsCount: romMap.size,
    gamesCount,
    matched,
    missingRoms: missingRoms.sort((a, b) => a.localeCompare(b)),
    orphanRoms: orphanRoms.sort((a, b) => a.localeCompare(b)),
    occupancyPct: gamesCount > 0 ? Math.round((matched / gamesCount) * 100) : 0,
  };
}

export async function reconcileAll(): Promise<LibraryReport> {
  const names = listCatalogPlatformNames();
  const platforms: PlatformReconciliation[] = [];

  for (const name of names) {
    try {
      const rec = await reconcilePlatform(name);
      if (rec && (rec.gamesCount > 0 || rec.romsCount > 0)) {
        platforms.push(rec);
      }
    } catch (error) {
      console.warn("Falha ao reconciliar plataforma:", name, error);
    }
  }

  platforms.sort((a, b) => a.platform.localeCompare(b.platform));

  const totals = platforms.reduce(
    (acc, p) => {
      acc.games += p.gamesCount;
      acc.roms += p.romsCount;
      acc.matched += p.matched;
      acc.missing += p.missingRoms.length;
      acc.orphans += p.orphanRoms.length;
      return acc;
    },
    { games: 0, roms: 0, matched: 0, missing: 0, orphans: 0, occupancyPct: 0 },
  );
  totals.occupancyPct =
    totals.games > 0 ? Math.round((totals.matched / totals.games) * 100) : 0;

  return { platforms, totals };
}
