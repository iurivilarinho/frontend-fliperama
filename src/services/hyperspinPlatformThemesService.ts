import { convertFileSrc } from "@tauri-apps/api/core";
import { join } from "./path";
import { exists, readDir } from "./fs";
import { loadRuntimeIniConfig } from "./iniConfig";

export type HyperspinPlatformTheme = {
  name: string;
  themeZipPath: string;
  wheelImagePath: string | null;
  wheelImageUrl: string | null;
  videoPath: string | null;
  videoUrl: string | null;
};

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"];
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".m4v", ".mov", ".avi"];

function removeExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/i, "").trim();
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function sortPlatforms(
  firstItem: HyperspinPlatformTheme,
  secondItem: HyperspinPlatformTheme,
): number {
  return firstItem.name.localeCompare(secondItem.name, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

async function safeReadDir(path: string) {
  if (!(await exists(path))) return [];
  return readDir(path);
}

async function buildNamedFileMap(
  directoryPath: string,
  allowedExtensions: string[],
): Promise<Map<string, string>> {
  const entries = await safeReadDir(directoryPath);
  const files = new Map<string, string>();

  for (const entry of entries) {
    if (!entry.isFile || !entry.name) continue;

    const lowerName = entry.name.toLowerCase();
    const hasAllowedExtension = allowedExtensions.some((extension) =>
      lowerName.endsWith(extension),
    );

    if (!hasAllowedExtension) continue;

    const absolutePath = await join(directoryPath, entry.name);
    files.set(normalizeKey(removeExtension(entry.name)), absolutePath);
  }

  return files;
}

export async function listHyperspinPlatforms(): Promise<
  HyperspinPlatformTheme[]
> {
  const { themesBasePath } = await loadRuntimeIniConfig();

  const themesDir = await join(themesBasePath, "main_menu", "Themes");
  const wheelDir = await join(themesBasePath, "main_menu", "Images", "Wheel");
  const videoDir = await join(themesBasePath, "main_menu", "Video");

  if (!(await exists(themesDir))) {
    throw new Error(`Pasta não encontrada: ${themesDir}`);
  }

  const [themeEntries, wheelMap, videoMap] = await Promise.all([
    readDir(themesDir),
    buildNamedFileMap(wheelDir, IMAGE_EXTENSIONS),
    buildNamedFileMap(videoDir, VIDEO_EXTENSIONS),
  ]);

  const platforms: HyperspinPlatformTheme[] = [];

  for (const entry of themeEntries) {
    if (!entry.isFile || !entry.name) continue;
    if (!entry.name.toLowerCase().endsWith(".zip")) continue;

    const platformName = removeExtension(entry.name);
    const key = normalizeKey(platformName);
    const themeZipPath = await join(themesDir, entry.name);

    const wheelImagePath = wheelMap.get(key) ?? null;
    const videoPath = videoMap.get(key) ?? null;

    platforms.push({
      name: platformName,
      themeZipPath,
      wheelImagePath,
      wheelImageUrl: wheelImagePath ? convertFileSrc(wheelImagePath) : null,
      videoPath,
      videoUrl: videoPath ? convertFileSrc(videoPath) : null,
    });
  }

  return platforms.sort(sortPlatforms);
}
