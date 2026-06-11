import { appLocalDataDir, join } from "./path";
import {
  copyFile,
  exists,
  mkdir,
  readDir,
} from "./fs";
import { loadRuntimeIniConfig } from "./iniConfig";
import { execute, select } from "./db/client";

// Pastas de save conhecidas dos emuladores (relativas à raiz do HyperSpin).
// Os emuladores carregam os saves automaticamente daqui; o backup é uma cópia
// de segurança.
const SAVE_DIRS: { label: string; rel: string }[] = [
  { label: "RetroArch (saves)", rel: "Emulators/RetroArch/saves" },
  { label: "RetroArch (states)", rel: "Emulators/RetroArch/states" },
  { label: "MAME (nvram)", rel: "Emulators/MAME/nvram" },
  { label: "MAME (cfg)", rel: "Emulators/MAME/cfg" },
  { label: "Neo Geo (nvram)", rel: "Emulators/Neo Geo/nvram" },
  { label: "Nintendo 64 (Save)", rel: "Emulators/Nintendo 64/Save" },
  { label: "NES (save)", rel: "Emulators/Nintendo Entertainment System/save" },
  { label: "SNES (saves)", rel: "Emulators/Super Nintendo Entertainment System/saves" },
  { label: "Sega (saves)", rel: "Emulators/Sega/saves" },
];

export type SaveLocation = {
  label: string;
  dir: string;
  exists: boolean;
  fileCount: number;
};

async function countFiles(dir: string): Promise<number> {
  if (!(await exists(dir))) return 0;
  let total = 0;
  const entries = await readDir(dir);
  for (const e of entries) {
    if (e.isFile) total += 1;
    else if (e.isDirectory) total += await countFiles(await join(dir, e.name));
  }
  return total;
}

export async function listSaveLocations(): Promise<SaveLocation[]> {
  const ini = await loadRuntimeIniConfig();
  const out: SaveLocation[] = [];
  for (const { label, rel } of SAVE_DIRS) {
    const dir = await join(ini.hyperspinBasePath, rel);
    const present = await exists(dir);
    out.push({
      label,
      dir,
      exists: present,
      fileCount: present ? await countFiles(dir) : 0,
    });
  }
  return out;
}

async function copyDirRecursive(
  src: string,
  dest: string,
  onFile: (relPath: string, destPath: string) => Promise<void>,
  relBase = "",
): Promise<number> {
  await mkdir(dest, { recursive: true });
  let count = 0;
  const entries = await readDir(src);
  for (const e of entries) {
    if (!e.name) continue;
    const s = await join(src, e.name);
    const d = await join(dest, e.name);
    const rel = relBase ? `${relBase}/${e.name}` : e.name;
    if (e.isDirectory) {
      count += await copyDirRecursive(s, d, onFile, rel);
    } else if (e.isFile) {
      await copyFile(s, d);
      await onFile(rel, d);
      count += 1;
    }
  }
  return count;
}

export type BackupResult = { backupDir: string; fileCount: number };

/**
 * Faz um backup de todos os saves existentes para
 * <appLocalData>/fliperama-saves/<timestamp>/ e registra no banco.
 */
export async function backupSaves(
  userId: string | null = null,
): Promise<BackupResult> {
  const ini = await loadRuntimeIniConfig();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const root = await join(await appLocalDataDir(), "fliperama-saves", stamp);

  let total = 0;
  for (const { label, rel } of SAVE_DIRS) {
    const srcDir = await join(ini.hyperspinBasePath, rel);
    if (!(await exists(srcDir))) continue;

    const destDir = await join(root, rel.replace(/[\\/]/g, "__"));
    const updatedAt = new Date().toISOString();

    total += await copyDirRecursive(srcDir, destDir, async (relPath, destPath) => {
      try {
        await execute(
          "INSERT INTO saves (user_id, platform_name, rom_name, file_path, updated_at) VALUES (?, ?, ?, ?, ?)",
          [userId, label, relPath, destPath, updatedAt],
        );
      } catch {
        // ignore registro
      }
    });
  }

  return { backupDir: root, fileCount: total };
}

export type SaveRow = {
  id: number;
  user_id: string | null;
  platform_name: string;
  rom_name: string;
  file_path: string;
  updated_at: string;
};

export async function listRecentSaves(limit = 50): Promise<SaveRow[]> {
  try {
    return await select<SaveRow>(
      "SELECT * FROM saves ORDER BY id DESC LIMIT ?",
      [limit],
    );
  } catch {
    return [];
  }
}

export async function countBackups(): Promise<number> {
  try {
    const rows = await select<{ n: number }>(
      "SELECT COUNT(DISTINCT updated_at) AS n FROM saves",
    );
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}
