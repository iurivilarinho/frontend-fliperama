import { basename, join } from "@tauri-apps/api/path";
import { copyFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { registerUploadedGame } from "./db/platformConfig";
import type { ManageablePlatform } from "./platforms";

export type UploadResult = {
  file: string;
  ok: boolean;
  reason?: string;
};

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function removeExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

/**
 * Copia os arquivos enviados para a pasta de ROMs da plataforma, validando a
 * extensão, e registra cada jogo no banco. Não sobrescreve arquivos existentes.
 */
export async function uploadGameFiles(
  platform: ManageablePlatform,
  sourcePaths: string[],
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  if (!(await exists(platform.romsDir))) {
    await mkdir(platform.romsDir, { recursive: true });
  }

  const allowed = platform.extensions.map((e) => e.toLowerCase());

  for (const source of sourcePaths) {
    const fileName = await basename(source);
    const ext = getExtension(fileName);

    if (!allowed.includes(ext)) {
      results.push({
        file: fileName,
        ok: false,
        reason: `Extensão ${ext || "(sem)"} não permitida para ${platform.name}`,
      });
      continue;
    }

    try {
      const destination = await join(platform.romsDir, fileName);

      if (await exists(destination)) {
        results.push({ file: fileName, ok: false, reason: "Já existe" });
        continue;
      }

      await copyFile(source, destination);
      await registerUploadedGame({
        platformName: platform.name,
        romName: removeExtension(fileName),
        title: removeExtension(fileName),
        filePath: destination,
      });

      results.push({ file: fileName, ok: true });
    } catch (error) {
      console.error("Falha no upload:", source, error);
      results.push({
        file: fileName,
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
