// Regras puras de validação de upload (sem dependência de Tauri/DOM).

export function normalizeExtensions(list: string[]): string[] {
  return list
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .map((e) => (e.startsWith(".") ? e : `.${e}`));
}

export function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

export function removeExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

export function isExtensionAllowed(
  fileName: string,
  allowedExtensions: string[],
): boolean {
  const ext = getExtension(fileName);
  if (!ext) return false;
  return normalizeExtensions(allowedExtensions).includes(ext);
}
