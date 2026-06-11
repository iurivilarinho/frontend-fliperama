import { loadRuntimeIniConfig } from "./iniConfig";
import {
  listCatalogPlatformNames,
  resolvePlatformConfig,
} from "./platformCatalog";
import {
  getAllPlatformConfig,
  type PlatformConfigOverride,
} from "./db/platformConfig";

export type ManageablePlatform = {
  name: string;
  romsDir: string;
  emulatorPath: string;
  corePath: string | null;
  databaseFolder: string;
  extensions: string[]; // efetivas (override do admin ou padrão do catálogo)
  defaultExtensions: string[];
  enabled: boolean;
  launchProfile: string;
  gameImport: "file" | "folder";
};

/**
 * Lista as plataformas que podem receber upload de jogos: as do catálogo,
 * com a pasta de ROMs resolvida e as extensões efetivas (override do banco
 * quando houver, senão o padrão do catálogo).
 */
export async function listManageablePlatforms(): Promise<ManageablePlatform[]> {
  const ini = await loadRuntimeIniConfig();
  const overrides: Record<string, PlatformConfigOverride> =
    await getAllPlatformConfig().catch(() => ({}));
  const names = await listCatalogPlatformNames();

  const result: ManageablePlatform[] = [];
  for (const name of names) {
    const cfg = await resolvePlatformConfig(ini.hyperspinBasePath, name);
    if (!cfg) continue;

    const override = overrides[name];
    const extensions =
      override?.extensions && override.extensions.length
        ? override.extensions
        : cfg.romExtensions;

    result.push({
      name,
      romsDir: cfg.romsDir,
      emulatorPath: cfg.emulatorPath,
      corePath: cfg.corePath,
      databaseFolder: cfg.databaseFolder,
      extensions,
      defaultExtensions: cfg.romExtensions,
      enabled: override?.enabled ?? true,
      launchProfile: cfg.launchProfile,
      gameImport: cfg.gameImport,
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return result;
}
