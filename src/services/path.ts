// Ponte de path: usa @tauri-apps/api/path no app, ou cálculo em JS puro + dirs do
// host (via API HTTP) quando rodando num navegador remoto. join/basename/dirname
// são puros; appConfigDir/appLocalDataDir vêm do host (cacheados).
import * as tauriPath from "@tauri-apps/api/path";
import { apiBase, isTauri } from "./remoteHost";
import { jsBasename, jsDirname, jsJoin } from "./pathUtils";

interface HostDirs {
  sep: string;
  appConfigDir: string;
  appLocalDataDir: string;
}

let dirsCache: HostDirs | null = null;

async function hostDirs(): Promise<HostDirs> {
  if (dirsCache) return dirsCache;
  const res = await fetch(`${apiBase()}/api/fs/dirs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`fs/dirs HTTP ${res.status}`);
  dirsCache = (await res.json()) as HostDirs;
  return dirsCache;
}

export async function join(...parts: string[]): Promise<string> {
  if (isTauri) return tauriPath.join(...parts);
  const { sep } = await hostDirs();
  return jsJoin(sep, parts);
}

export async function basename(path: string): Promise<string> {
  if (isTauri) return tauriPath.basename(path);
  return jsBasename(path);
}

export async function dirname(path: string): Promise<string> {
  if (isTauri) return tauriPath.dirname(path);
  const { sep } = await hostDirs();
  return jsDirname(sep, path);
}

export async function appConfigDir(): Promise<string> {
  if (isTauri) return tauriPath.appConfigDir();
  return (await hostDirs()).appConfigDir;
}

export async function appLocalDataDir(): Promise<string> {
  if (isTauri) return tauriPath.appLocalDataDir();
  return (await hostDirs()).appLocalDataDir;
}
