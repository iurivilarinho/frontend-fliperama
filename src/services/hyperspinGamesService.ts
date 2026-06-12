import { convertFileSrc } from "@tauri-apps/api/core";
import { join } from "./path";
import { exists, readDir, readTextFile } from "./fs";
import { loadRuntimeIniConfig } from "./iniConfig";
import { getPlatformRuntimeConfig } from "./platformRuntimeConfig";
import { getShowWithoutRoms } from "./db/settings";
import { listUploadedGames } from "./db/platformConfig";

export type HyperspinGame = {
  name: string;
  description: string;
  manufacturer: string | null;
  year: string | null;
  genre: string | null;
  rating: string | null;
  /** Arcade (MAME): nº de jogadores, botões e tipo de controle (via -listxml). */
  players: number | null;
  buttons: number | null;
  control: string | null;
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

type MameMeta = {
  players: number | null;
  buttons: number | null;
  control: string | null;
};

async function loadMameMeta(
  metaPath: string,
): Promise<Record<string, MameMeta>> {
  try {
    if (!(await exists(metaPath))) return {};
    return JSON.parse(await readTextFile(metaPath)) as Record<string, MameMeta>;
  } catch {
    return {};
  }
}

/**
 * Verifica (de forma leve) se a plataforma tem pelo menos um jogo jogável, sem
 * montar os mapas de mídia (Wheel/Snap/Video) — usado para esconder plataformas
 * vazias (ex.: Daphne) da seleção. Regras espelham `listHyperspinGames`:
 * - "mostrar sem ROMs" ligado: basta haver qualquer <game> no XML ou um envio.
 * - normal: precisa de uma ROM no disco que case com um <game> do XML, ou um
 *   jogo enviado pelo painel cujo arquivo exista.
 * Em caso de erro, retorna `true` (fail-open: não esconde por dúvida).
 */
export async function platformHasPlayableGames(
  platformName: string,
): Promise<boolean> {
  try {
    const [showWithoutRoms, uploaded, runtimeConfig] = await Promise.all([
      getShowWithoutRoms().catch(() => false),
      listUploadedGames(platformName).catch(
        () => [] as Awaited<ReturnType<typeof listUploadedGames>>,
      ),
      getPlatformRuntimeConfig(platformName),
    ]);

    // Jogos enviados pelo painel com arquivo no disco já contam.
    for (const row of uploaded) {
      if (row.file_path && (await exists(row.file_path))) return true;
    }

    if (!runtimeConfig) return false;

    const { databasePath } = await loadRuntimeIniConfig();
    const xmlPath = await join(
      databasePath,
      runtimeConfig.databaseFolder,
      `${runtimeConfig.databaseFolder}.xml`,
    );
    if (!(await exists(xmlPath))) return false;

    if (showWithoutRoms) {
      // Qualquer <game> no XML já basta (o admin optou por mostrar sem ROM).
      const xml = await readTextFile(xmlPath);
      return /<game\b/i.test(xml);
    }

    // Precisa de pelo menos uma ROM no disco que case com um <game> do XML.
    const romMap = await buildRomMap(
      runtimeConfig.romsDir,
      runtimeConfig.romExtensions,
    ).catch(() => new Map<string, string>());
    if (romMap.size === 0) return false;

    const xml = await readTextFile(xmlPath);
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    for (const el of Array.from(doc.getElementsByTagName("game"))) {
      const name = el.getAttribute("name")?.trim();
      if (name && romMap.has(normalizeRomKey(name))) return true;
    }
    return false;
  } catch {
    return true;
  }
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

  // Metadata extra do arcade (players/buttons/control) gerada do MAME -listxml,
  // se presente ao lado do XML. Enriquece a ficha do jogo (só arcade/MAME).
  const mameMeta = await loadMameMeta(
    await join(databasePath, runtimeConfig.databaseFolder, "_mame_meta.json"),
  );

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
  // Index por nome normalizado para mesclar jogos enviados pelo painel.
  const byKey = new Map<string, HyperspinGame>();

  for (const gameElement of gameElements) {
    const rawName = gameElement.getAttribute("name")?.trim();

    if (!rawName) continue;

    const romKey = normalizeRomKey(rawName);

    // Alguns bancos do HyperSpin trazem o MESMO jogo repetido (ex.: o SNES tem
    // ~37 nomes duplicados). Ignora a repetição — senão a roda gera keys iguais
    // no React e as imagens se sobrepõem / a navegação "pula de dois".
    if (byKey.has(romKey)) {
      continue;
    }

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
    const rating = getTextContent(gameElement, "rating");

    const mediaKey = normalizeMediaKey(rawName);

    const wheelImagePath = wheelMap.get(mediaKey) ?? null;
    const backgroundImagePath = snapMap.get(mediaKey) ?? null;
    const videoPath = videoMap.get(mediaKey) ?? null;

    const game: HyperspinGame = {
      name: rawName,
      description,
      manufacturer,
      year,
      genre,
      rating,
      players: mameMeta[rawName]?.players ?? null,
      buttons: mameMeta[rawName]?.buttons ?? null,
      control: mameMeta[rawName]?.control ?? null,
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
    };
    games.push(game);
    byKey.set(romKey, game);
  }

  // Mescla jogos enviados pelo painel (tabela uploaded_games). O alvo de
  // execução vem do file_path registrado — cobre tanto arquivos copiados quanto
  // jogos referenciados in-place (pastas de PS3 → EBOOT.BIN). Jogos que não
  // estão no XML entram aqui como entradas novas.
  let uploaded: Awaited<ReturnType<typeof listUploadedGames>> = [];
  try {
    uploaded = await listUploadedGames(platformName);
  } catch (error) {
    console.warn("Não foi possível ler jogos enviados:", platformName, error);
  }

  for (const row of uploaded) {
    const romKey = normalizeRomKey(row.rom_name);
    const fileExists = row.file_path ? await exists(row.file_path) : false;

    const existing = byKey.get(romKey);
    if (existing) {
      // Já estava no XML: completa o caminho da ROM se faltava.
      if (!existing.hasRom && fileExists) {
        existing.romPath = row.file_path;
        existing.hasRom = true;
      }
      continue;
    }

    if (!fileExists && !showWithoutRoms) continue;

    const label = row.title?.trim() || row.rom_name;
    const mediaKey = normalizeMediaKey(row.rom_name);
    const wheelImagePath = wheelMap.get(mediaKey) ?? null;
    const backgroundImagePath = snapMap.get(mediaKey) ?? null;
    const videoPath = videoMap.get(mediaKey) ?? null;

    const game: HyperspinGame = {
      name: row.rom_name,
      description: label,
      manufacturer: null,
      year: null,
      genre: null,
      rating: null,
      players: null,
      buttons: null,
      control: null,
      romPath: fileExists ? row.file_path : "",
      hasRom: fileExists,
      wheelImagePath,
      wheelImageUrl: wheelImagePath ? convertFileSrc(wheelImagePath) : null,
      backgroundImagePath,
      backgroundImageUrl: backgroundImagePath
        ? convertFileSrc(backgroundImagePath)
        : null,
      videoPath,
      videoUrl: videoPath ? convertFileSrc(videoPath) : null,
    };
    games.push(game);
    byKey.set(romKey, game);
  }

  return games.sort(sortGames);
}
