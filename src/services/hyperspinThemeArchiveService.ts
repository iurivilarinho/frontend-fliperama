import { appLocalDataDir, join } from "./path";
import {
  exists,
  mkdir,
  readFile,
  readTextFile,
  writeFile,
} from "./fs";
import JSZip from "jszip";

function normalizeSlashes(value: string): string {
  return value.replaceAll("\\", "/");
}

function sanitizeCacheKey(value: string): string {
  return normalizeSlashes(value)
    .replace(/[^a-zA-Z0-9/_-]/g, "_")
    .replaceAll("/", "__");
}

function getFileName(path: string): string {
  const normalized = normalizeSlashes(path);
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? normalized;
}

function isThemeXml(path: string): boolean {
  return /(^|\/)theme\.xml$/i.test(normalizeSlashes(path));
}

function isDirectoryEntry(path: string): boolean {
  return path.endsWith("/");
}

async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) {
    await mkdir(path, { recursive: true });
  }
}

async function writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
  const normalized = normalizeSlashes(path);
  const parts = normalized.split("/");
  parts.pop();

  const parentDir = parts.join("/");
  if (parentDir) {
    await ensureDir(parentDir);
  }

  await writeFile(path, data);
}

async function writeTextUtf8File(path: string, text: string): Promise<void> {
  const normalized = normalizeSlashes(path);
  const parts = normalized.split("/");
  parts.pop();

  const parentDir = parts.join("/");
  if (parentDir) {
    await ensureDir(parentDir);
  }

  await writeFile(path, new TextEncoder().encode(text));
}

export async function extractThemeZipToCache(themeZipPath: string): Promise<{
  extractedDir: string;
  themeXmlPath: string;
}> {
  const zipBytes = await readFile(themeZipPath);
  const zip = await JSZip.loadAsync(zipBytes);

  const cacheRoot = normalizeSlashes(
    await join(await appLocalDataDir(), "hyperspin-theme-cache"),
  );
  const cacheDir = normalizeSlashes(
    await join(cacheRoot, sanitizeCacheKey(themeZipPath)),
  );

  await ensureDir(cacheDir);

  let foundThemeXmlPath: string | null = null;

  const entries = Object.values(zip.files);

  for (const entry of entries) {
    const entryName = normalizeSlashes(entry.name);

    if (isDirectoryEntry(entryName)) {
      await ensureDir(normalizeSlashes(await join(cacheDir, entryName)));
      continue;
    }

    const outputPath = normalizeSlashes(await join(cacheDir, entryName));

    if (entryName.toLowerCase().endsWith(".xml")) {
      const content = await entry.async("string");
      await writeTextUtf8File(outputPath, content);

      if (!foundThemeXmlPath && isThemeXml(entryName)) {
        foundThemeXmlPath = outputPath;
      }
    } else {
      const content = await entry.async("uint8array");
      await writeBinaryFile(outputPath, content);
    }
  }

  if (!foundThemeXmlPath) {
    const candidate = normalizeSlashes(await join(cacheDir, "Theme.xml"));

    if (await exists(candidate)) {
      foundThemeXmlPath = candidate;
    }
  }

  if (!foundThemeXmlPath) {
    throw new Error(
      `Theme.xml não encontrado dentro do zip: ${getFileName(themeZipPath)}`,
    );
  }

  return {
    extractedDir: cacheDir,
    themeXmlPath: foundThemeXmlPath,
  };
}

export async function findThemeXmlInsideExtractedDir(
  extractedDir: string,
): Promise<string | null> {
  const rootThemeXml = normalizeSlashes(await join(extractedDir, "Theme.xml"));

  if (await exists(rootThemeXml)) {
    return rootThemeXml;
  }

  return null;
}

export async function readCachedThemeXml(
  themeXmlPath: string,
): Promise<string> {
  return readTextFile(themeXmlPath);
}
