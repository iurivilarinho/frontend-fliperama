import { exists, readTextFile } from "./fs";
import { dirname, join } from "./path";

// O acervo de MAME é MISTO: a maioria dos jogos roda no MAME 0.254 (mame.exe),
// mas ~40 têm ROM da era 0.142 e só abrem no mame_legacy.exe. O mapa por jogo
// fica em Emulators/MAME/_mame_route.json. Este módulo escolhe o exe certo.

let legacyCache: Set<string> | null = null;

async function loadLegacySet(mameDir: string): Promise<Set<string>> {
  if (legacyCache) return legacyCache;
  try {
    const routePath = await join(mameDir, "_mame_route.json");
    if (await exists(routePath)) {
      const data = JSON.parse(await readTextFile(routePath)) as {
        legacy0142?: string[];
      };
      legacyCache = new Set(data.legacy0142 ?? []);
    } else {
      legacyCache = new Set();
    }
  } catch {
    legacyCache = new Set();
  }
  return legacyCache;
}

/**
 * Resolve qual executável do MAME usar para um jogo. Retorna o `mame_legacy.exe`
 * (0.142) para os jogos roteados; senão o próprio `emulatorPath` (0.254).
 */
export async function resolveMameExe(
  emulatorPath: string,
  romName: string,
): Promise<string> {
  const mameDir = await dirname(emulatorPath);
  const legacy = await loadLegacySet(mameDir);
  if (!legacy.has(romName)) return emulatorPath;
  return join(mameDir, "mame_legacy.exe");
}
