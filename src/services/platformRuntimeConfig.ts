import { loadRuntimeIniConfig } from "./iniConfig";
import {
  resolvePlatformConfig,
  type LaunchProfile,
  type ResolvedPlatformConfig,
} from "./platformCatalog";

export type { LaunchProfile, ResolvedPlatformConfig };

/**
 * Retorna a configuração de execução de uma plataforma (emulador, ROMs, banco
 * e perfil de launch), resolvida a partir do catálogo + raiz do HyperSpin.
 *
 * Retorna null quando a plataforma não tem emulador/ROMs configurados no
 * catálogo — nesse caso a plataforma aparece no menu, mas não lista jogos.
 */
export async function getPlatformRuntimeConfig(
  platformName: string,
): Promise<ResolvedPlatformConfig | null> {
  const iniConfig = await loadRuntimeIniConfig();

  if (!iniConfig.hyperspinBasePath) {
    throw new Error(
      `hyperspinBasePath não configurado. Edite o arquivo:\n${iniConfig.iniPath}\n\n` +
        `Na seção [runtime], informe hyperspinBasePath=...`,
    );
  }

  return resolvePlatformConfig(iniConfig.hyperspinBasePath, platformName);
}
