import { basename, join } from "@tauri-apps/api/path";
import { copyFile, exists, mkdir, readDir } from "@tauri-apps/plugin-fs";
import { registerUploadedGame } from "./db/platformConfig";
import type { ManageablePlatform } from "./platforms";
import { getExtension, isExtensionAllowed, removeExtension } from "./uploadRules";

export type UploadResult = {
  file: string;
  ok: boolean;
  reason?: string;
};

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

  for (const source of sourcePaths) {
    const fileName = await basename(source);

    if (!isExtensionAllowed(fileName, platform.extensions)) {
      results.push({
        file: fileName,
        ok: false,
        reason: `Extensão ${getExtension(fileName) || "(sem)"} não permitida para ${platform.name}`,
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

/**
 * Procura recursivamente o EBOOT.BIN dentro de uma pasta de jogo de PS3
 * (estrutura típica: <jogo>/PS3_GAME/USRDIR/EBOOT.BIN). Limita a profundidade
 * para não varrer a árvore inteira.
 */
async function findEboot(dir: string, depth = 0): Promise<string | null> {
  if (depth > 4) return null;
  let entries: Awaited<ReturnType<typeof readDir>>;
  try {
    entries = await readDir(dir);
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry.isFile && entry.name?.toLowerCase() === "eboot.bin") {
      return join(dir, entry.name);
    }
  }
  for (const entry of entries) {
    if (entry.isDirectory && entry.name) {
      const found = await findEboot(await join(dir, entry.name), depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Adiciona um jogo a partir de uma PASTA (ex.: PS3). Localiza o EBOOT.BIN e o
 * registra como alvo de execução, sem copiar a pasta (jogos de PS3 têm vários
 * GB — referenciamos no local onde estão). O jogo passa a aparecer e a abrir
 * pela interface, lançado pelo RPCS3.
 */
export async function uploadGameFolder(
  platform: ManageablePlatform,
  folderPath: string,
): Promise<UploadResult> {
  const folderName = await basename(folderPath);

  const eboot = await findEboot(folderPath);
  if (!eboot) {
    return {
      file: folderName,
      ok: false,
      reason: "EBOOT.BIN não encontrado (estrutura de jogo PS3 inválida)",
    };
  }

  try {
    await registerUploadedGame({
      platformName: platform.name,
      romName: folderName,
      title: folderName,
      filePath: eboot,
    });
    return { file: folderName, ok: true };
  } catch (error) {
    console.error("Falha ao adicionar pasta:", folderPath, error);
    return {
      file: folderName,
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
