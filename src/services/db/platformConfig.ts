import { execute, select } from "./client";

export type PlatformConfigRow = {
  platform_name: string;
  rom_extensions: string | null;
  enabled: number;
};

export type PlatformConfigOverride = {
  extensions: string[] | null;
  enabled: boolean;
};

function parseCsvExtensions(csv: string | null): string[] | null {
  if (!csv) return null;
  const list = csv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((e) => (e.startsWith(".") ? e : `.${e}`));
  return list.length ? list : null;
}

export async function getAllPlatformConfig(): Promise<
  Record<string, PlatformConfigOverride>
> {
  const rows = await select<PlatformConfigRow>(
    "SELECT * FROM platform_config",
  );
  const out: Record<string, PlatformConfigOverride> = {};
  for (const row of rows) {
    out[row.platform_name] = {
      extensions: parseCsvExtensions(row.rom_extensions),
      enabled: row.enabled === 1,
    };
  }
  return out;
}

export async function setPlatformExtensions(
  platformName: string,
  extensions: string[],
): Promise<void> {
  const csv = extensions
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .map((e) => (e.startsWith(".") ? e : `.${e}`))
    .join(",");

  await execute(
    "INSERT INTO platform_config (platform_name, rom_extensions, enabled) VALUES (?, ?, 1) " +
      "ON CONFLICT(platform_name) DO UPDATE SET rom_extensions = excluded.rom_extensions",
    [platformName, csv],
  );
}

export async function setPlatformEnabled(
  platformName: string,
  enabled: boolean,
): Promise<void> {
  await execute(
    "INSERT INTO platform_config (platform_name, rom_extensions, enabled) VALUES (?, NULL, ?) " +
      "ON CONFLICT(platform_name) DO UPDATE SET enabled = excluded.enabled",
    [platformName, enabled ? 1 : 0],
  );
}

export async function registerUploadedGame(params: {
  platformName: string;
  romName: string;
  title?: string | null;
  filePath: string;
}): Promise<void> {
  await execute(
    "INSERT INTO uploaded_games (platform_name, rom_name, title, file_path, created_at) VALUES (?, ?, ?, ?, ?)",
    [
      params.platformName,
      params.romName,
      params.title ?? null,
      params.filePath,
      new Date().toISOString(),
    ],
  );
}

export type UploadedGameRow = {
  id: number;
  platform_name: string;
  rom_name: string;
  title: string | null;
  file_path: string;
  created_at: string;
};

export async function listUploadedGames(
  platformName: string,
): Promise<UploadedGameRow[]> {
  return select<UploadedGameRow>(
    "SELECT * FROM uploaded_games WHERE platform_name = ? ORDER BY created_at DESC",
    [platformName],
  );
}
