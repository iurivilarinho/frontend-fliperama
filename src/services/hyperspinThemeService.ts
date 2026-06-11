import { convertFileSrc } from "@tauri-apps/api/core";
import { dirname, join } from "./path";
import { exists, readTextFile } from "./fs";
import type {
  HyperspinLayerType,
  HyperspinTheme,
  HyperspinThemeLayer,
} from "../types/hyperspinTheme";

const DEFAULT_THEME_WIDTH = 1024;
const DEFAULT_THEME_HEIGHT = 768;

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"];
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".avi"];
const FLASH_EXTENSIONS = [".swf"];

function normalizeSlashes(value: string): string {
  return value.replaceAll("\\", "/").trim();
}

function isAbsolutePath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("/") || path.startsWith("\\\\");
}

function getExtension(path: string): string {
  const normalized = normalizeSlashes(path).toLowerCase();
  const index = normalized.lastIndexOf(".");
  return index >= 0 ? normalized.slice(index) : "";
}

function inferLayerType(path: string): HyperspinLayerType {
  const extension = getExtension(path);

  if (IMAGE_EXTENSIONS.includes(extension)) return "image";
  if (VIDEO_EXTENSIONS.includes(extension)) return "video";
  if (FLASH_EXTENSIONS.includes(extension)) return "flash";

  return "unknown";
}

function toNumber(value: string | null | undefined, fallback = 0): number {
  if (!value) return fallback;

  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: string | null | undefined, fallback = true): boolean {
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;

  return fallback;
}

function getAttributes(element: Element): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const attribute of Array.from(element.attributes)) {
    attributes[attribute.name] = attribute.value;
  }

  return attributes;
}

function getAttributeValue(
  attributes: Record<string, string>,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const value = attributes[name];
    if (value != null && value !== "") {
      return value;
    }
  }

  return undefined;
}

function getOpacity(attributes: Record<string, string>): number {
  const rawValue = getAttributeValue(
    attributes,
    "alpha",
    "opacity",
    "transparency",
    "a",
  );

  if (!rawValue) return 1;

  const parsed = toNumber(rawValue, 1);

  if (parsed > 1) {
    return Math.max(0, Math.min(1, parsed / 255));
  }

  return Math.max(0, Math.min(1, parsed));
}

async function resolveAbsolutePath(xmlPath: string, assetPath: string): Promise<string> {
  if (isAbsolutePath(assetPath)) {
    return normalizeSlashes(assetPath);
  }

  const xmlDirectory = await dirname(xmlPath);
  return normalizeSlashes(await join(xmlDirectory, assetPath));
}

async function resolveConventionAssetPath(
  xmlPath: string,
  baseName: string,
  extensions: string[],
): Promise<string | null> {
  const xmlDirectory = await dirname(xmlPath);

  for (const extension of extensions) {
    const candidate = normalizeSlashes(await join(xmlDirectory, `${baseName}${extension}`));

    if (await exists(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function inferSourceFromTagName(
  xmlPath: string,
  element: Element,
): Promise<string | null> {
  const tagName = element.tagName.toLowerCase();

  if (tagName === "video") {
    return resolveConventionAssetPath(xmlPath, "Video", VIDEO_EXTENSIONS);
  }

  if (tagName === "artwork1") {
    return resolveConventionAssetPath(xmlPath, "Artwork1", IMAGE_EXTENSIONS);
  }

  if (tagName === "artwork2") {
    return resolveConventionAssetPath(xmlPath, "Artwork2", IMAGE_EXTENSIONS);
  }

  if (tagName === "artwork3") {
    return resolveConventionAssetPath(xmlPath, "Artwork3", IMAGE_EXTENSIONS);
  }

  if (tagName === "artwork4") {
    return resolveConventionAssetPath(xmlPath, "Artwork4", IMAGE_EXTENSIONS);
  }

  if (tagName === "background") {
    return resolveConventionAssetPath(xmlPath, "Background", IMAGE_EXTENSIONS);
  }

  return null;
}

async function extractSource(
  xmlPath: string,
  element: Element,
  attributes: Record<string, string>,
): Promise<string | null> {
  const explicitValue =
    getAttributeValue(
      attributes,
      "path",
      "src",
      "source",
      "file",
      "filename",
      "image",
      "video",
      "swf",
      "asset",
      "texture",
    ) ?? element.textContent?.trim();

  if (explicitValue) {
    const normalized = normalizeSlashes(explicitValue);

    if (normalized && normalized.includes(".")) {
      return resolveAbsolutePath(xmlPath, normalized);
    }
  }

  return inferSourceFromTagName(xmlPath, element);
}

function inferBaseWidth(document: Document): number {
  const rootAttributes = getAttributes(document.documentElement);
  return toNumber(getAttributeValue(rootAttributes, "width", "w"), DEFAULT_THEME_WIDTH);
}

function inferBaseHeight(document: Document): number {
  const rootAttributes = getAttributes(document.documentElement);
  return toNumber(getAttributeValue(rootAttributes, "height", "h"), DEFAULT_THEME_HEIGHT);
}

function inferLayerName(
  element: Element,
  attributes: Record<string, string>,
  index: number,
): string {
  return (
    getAttributeValue(attributes, "name", "id") ??
    element.tagName.toLowerCase() ??
    `layer-${index}`
  );
}

function inferLayerZIndex(element: Element, index: number): number {
  const tagName = element.tagName.toLowerCase();

  if (tagName === "background") return 0;
  if (tagName === "video") return 10;
  if (tagName === "artwork1") return 20;
  if (tagName === "artwork2") return 30;
  if (tagName === "artwork3") return 40;
  if (tagName === "artwork4") return 50;

  return index;
}

export async function loadHyperspinTheme(xmlPath: string): Promise<HyperspinTheme> {
  const xmlContent = await readTextFile(xmlPath);

  const parser = new DOMParser();
  const document = parser.parseFromString(xmlContent, "application/xml");
  const parseError = document.querySelector("parsererror");

  if (parseError) {
    throw new Error(`Falha ao interpretar o XML do theme: ${xmlPath}`);
  }

  const baseWidth = inferBaseWidth(document);
  const baseHeight = inferBaseHeight(document);
  const elements = Array.from(document.getElementsByTagName("*"));
  const layers: HyperspinThemeLayer[] = [];

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    const attributes = getAttributes(element);
    const absolutePath = await extractSource(xmlPath, element, attributes);

    if (!absolutePath) continue;

    const fileName = normalizeSlashes(absolutePath).split("/").pop() ?? absolutePath;

    layers.push({
      id: `${element.tagName}-${index}`,
      name: inferLayerName(element, attributes, index),
      type: inferLayerType(fileName),
      source: fileName,
      absolutePath,
      url: convertFileSrc(absolutePath),
      x: toNumber(getAttributeValue(attributes, "x", "left", "posx"), 0),
      y: toNumber(getAttributeValue(attributes, "y", "top", "posy"), 0),
      width: (() => {
        const value = getAttributeValue(attributes, "width", "w");
        return value != null ? toNumber(value) : undefined;
      })(),
      height: (() => {
        const value = getAttributeValue(attributes, "height", "h");
        return value != null ? toNumber(value) : undefined;
      })(),
      zIndex: toNumber(
        getAttributeValue(attributes, "z", "zIndex", "index", "layer"),
        inferLayerZIndex(element, index),
      ),
      opacity: getOpacity(attributes),
      visible: toBoolean(getAttributeValue(attributes, "visible", "enabled", "show"), true),
      loop: toBoolean(getAttributeValue(attributes, "loop"), true),
      rawAttributes: attributes,
    });
  }

  layers.sort((firstLayer, secondLayer) => firstLayer.zIndex - secondLayer.zIndex);

  return {
    name: normalizeSlashes(xmlPath).split("/").pop()?.replace(/\.xml$/i, "") ?? "theme",
    xmlPath: normalizeSlashes(xmlPath),
    baseWidth,
    baseHeight,
    layers,
  };
}