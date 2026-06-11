import { convertFileSrc } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { exists, readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { loadRuntimeIniConfig } from "./iniConfig";
import { getPlatformRuntimeConfig } from "./platformRuntimeConfig";
import { getShowWithoutRoms } from "./db/settings";

export type HyperspinGame = {
  name: string;
  description: string;
  manufacturer: string | null;
  year: string | null;
  genre: string | null;
  romPath: string;
  hasRom: boolean;
  wheelImagePath: string | null;
  wheelImageUrl: string | null;
  backgroundImagePath: string | null;
  backgroundImageUrl: string | null;
  videoPath: string | null;
  videoUrl: string | null;
};

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"];
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".m4v", ".mov", ".avi", ".flv"];

function getTextContent(parent: Element, tagName: string): string | null {
  const element = parent.getElementsByTagName(tagName)[0];
  const value = element?.textContent?.trim();

  return value ? value : null;
}

function sortGames(
  firstItem: HyperspinGame,
  secondItem: HyperspinGame,
): number {
  return firstItem.description.localeCompare(
    secondItem.description,
    undefined,
    {
      sensitivity: "base",
      numeric: true,
    },
  );
}

function removeExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/i, "").trim();
}

function normalizeMediaKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[^.]+$/i, "")
    .replace(/[^\w\s()-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeRomKey(value: string): string {
  return value.trim().toLowerCase();
}

// Junção de caminho LOCAL (sem IPC). O `join` do Tauri faz uma chamada ao
// backend por arquivo — com milhares de arquivos isso fica lento. Aqui montamos
// o caminho direto (Windows/Tauri aceitam ambos os separadores).
function pathJoin(directory: string, name: string): string {
  const sep = directory.includes("\\") ? "\\" : "/";
  return directory.replace(/[\\/]+$/, "") + sep + name;
}

async function buildMediaMap(
  directoryPath: string,
  allowedExtensions: string[],
): Promise<Map<string, string>> {
  const entries = await readDir(directoryPath);
  const mediaMap = new Map<string, string>();

  for (const entry of entries) {
    if (!entry.isFile || !entry.name) continue;

    const lowerName = entry.name.toLowerCase();
    const hasAllowedExtension = allowedExtensions.some((extension) =>
      lowerName.endsWith(extension),
    );

    if (!hasAllowedExtension) continue;

    const absolutePath = pathJoin(directoryPath, entry.name);
    const key = normalizeMediaKey(removeExtension(entry.name));

    if (!mediaMap.has(key)) {
      mediaMap.set(key, absolutePath);
    }
  }

  return mediaMap;
}

async function buildRomMap(
  romsDir: string,
  acceptedRomExtensions: string[],
): Promise<Map<string, string>> {
  const entries = await readDir(romsDir);
  const romMap = new Map<string, string>();

  for (const entry of entries) {
    if (!entry.isFile || !entry.name) continue;

    const lowerName = entry.name.toLowerCase();
    const hasAcceptedExtension = acceptedRomExtensions.some((extension) =>
      lowerName.endsWith(extension),
    );

    if (!hasAcceptedExtension) continue;

    const absolutePath = pathJoin(romsDir, entry.name);
    const key = normalizeRomKey(removeExtension(entry.name));

    if (!romMap.has(key)) {
      romMap.set(key, absolutePath);
    }
  }

  return romMap;
}

export async function listHyperspinGames(params: {
  platformName: string;
}): Promise<HyperspinGame[]> {
  const { platformName } = params;

  const runtimeConfig = await getPlatformRuntimeConfig(platformName);

  // Plataforma sem emulador/ROMs no catálogo: aparece no menu mas não lista jogos.
  if (!runtimeConfig) {
    return [];
  }

  const { databasePath, mediaBasePath } = await loadRuntimeIniConfig();

  const databaseXmlPath = await join(
    databasePath,
    runtimeConfig.databaseFolder,
    `${runtimeConfig.databaseFolder}.xml`,
  );

  // Plataforma sem banco de dados (XML ausente): aparece no menu mas não lista
  // jogos, em vez de quebrar com erro.
  if (!(await exists(databaseXmlPath))) {
    return [];
  }

  const xmlContent = await readTextFile(databaseXmlPath);

  const parser = new DOMParser();
  const document = parser.parseFromString(xmlContent, "application/xml");
  const parseError = document.querySelector("parsererror");

  if (parseError) {
    throw new Error(`Falha ao interpretar XML da plataforma: ${platformName}`);
  }

  const wheelDir = await join(mediaBasePath, platformName, "Images", "Wheel");
  const snapDir = await join(mediaBasePath, platformName, "Images", "Snap");
  const videoDir = await join(mediaBasePath, platformName, "Video");

  let wheelMap = new Map<string, string>();
  let snapMap = new Map<string, string>();
  let videoMap = new Map<string, string>();

  try {
    wheelMap = await buildMediaMap(wheelDir, IMAGE_EXTENSIONS);
  } catch (error) {
    console.warn("Não foi possível ler a pasta Wheel:", wheelDir, error);
  }

  try {
    snapMap = await buildMediaMap(snapDir, IMAGE_EXTENSIONS);
  } catch (error) {
    console.warn("Não foi possível ler a pasta Snap:", snapDir, error);
  }

  try {
    videoMap = await buildMediaMap(videoDir, VIDEO_EXTENSIONS);
  } catch (error) {
    console.warn("Não foi possível ler a pasta Video:", videoDir, error);
  }

  const romMap = await buildRomMap(
    runtimeConfig.romsDir,
    runtimeConfig.romExtensions,
  );

  // Parâmetro do admin: mostrar jogos mesmo sem ROM no disco.
  const showWithoutRoms = await getShowWithoutRoms();

  const gameElements = Array.from(document.getElementsByTagName("game"));
  const games: HyperspinGame[] = [];

  for (const gameElement of gameElements) {
    const rawName = gameElement.getAttribute("name")?.trim();

    if (!rawName) continue;

    const romKey = normalizeRomKey(rawName);
    const matchedRomPath = romMap.get(romKey);
    const hasRom = Boolean(matchedRomPath);

    // Sem ROM: só inclui se o parâmetro estiver ligado.
    if (!hasRom && !showWithoutRoms) {
      continue;
    }
    const romPath = matchedRomPath ?? "";

    const description = getTextContent(gameElement, "description") ?? rawName;
    const manufacturer = getTextContent(gameElement, "manufacturer");
    const year = getTextContent(gameElement, "year");
    const genre = getTextContent(gameElement, "genre");

    const mediaKey = normalizeMediaKey(rawName);

    const wheelImagePath = wheelMap.get(mediaKey) ?? null;
    const backgroundImagePath = snapMap.get(mediaKey) ?? null;
    const videoPath = videoMap.get(mediaKey) ?? null;

    games.push({
      name: rawName,
      description,
      manufacturer,
      year,
      genre,
      romPath,
      hasRom,
      wheelImagePath,
      wheelImageUrl: wheelImagePath ? convertFileSrc(wheelImagePath) : null,
      backgroundImagePath,
      backgroundImageUrl: backgroundImagePath
        ? convertFileSrc(backgroundImagePath)
        : null,
      videoPath,
      videoUrl: videoPath ? convertFileSrc(videoPath) : null,
    });
  }

  return games.sort(sortGames);
}
