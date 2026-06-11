// Ponte de filesystem: usa o plugin-fs do Tauri no app, ou a API HTTP embarcada
// (host) quando rodando num navegador remoto. Mesma assinatura do @tauri-apps/
// plugin-fs para os usos do projeto, então os serviços só trocam o import.
import * as tauriFs from "@tauri-apps/plugin-fs";
import { apiBase, isTauri } from "./remoteHost";

export interface DirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymlink: boolean;
}

async function fsApi<T>(op: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${apiBase()}/api/fs/${op}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `fs/${op} HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      // resposta sem corpo JSON
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function exists(path: string): Promise<boolean> {
  if (isTauri) return tauriFs.exists(path);
  return (await fsApi<{ exists: boolean }>("exists", { path })).exists;
}

export async function readDir(path: string): Promise<DirEntry[]> {
  if (isTauri) return tauriFs.readDir(path) as Promise<DirEntry[]>;
  return (await fsApi<{ entries: DirEntry[] }>("readDir", { path })).entries;
}

export async function readTextFile(path: string): Promise<string> {
  if (isTauri) return tauriFs.readTextFile(path);
  return (await fsApi<{ content: string }>("readTextFile", { path })).content;
}

export async function writeTextFile(
  path: string,
  contents: string,
): Promise<void> {
  if (isTauri) return tauriFs.writeTextFile(path, contents);
  await fsApi("writeTextFile", { path, content: contents });
}

export async function readFile(path: string): Promise<Uint8Array> {
  if (isTauri) return tauriFs.readFile(path);
  const { base64 } = await fsApi<{ base64: string }>("readFile", { path });
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export async function writeFile(path: string, data: Uint8Array): Promise<void> {
  if (isTauri) return tauriFs.writeFile(path, data);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < data.length; i += chunk) {
    bin += String.fromCharCode(...data.subarray(i, i + chunk));
  }
  await fsApi("writeFile", { path, base64: btoa(bin) });
}

export async function mkdir(
  path: string,
  options?: { recursive?: boolean },
): Promise<void> {
  if (isTauri) return tauriFs.mkdir(path, options);
  await fsApi("mkdir", { path, recursive: options?.recursive ?? false });
}

export async function copyFile(from: string, to: string): Promise<void> {
  if (isTauri) return tauriFs.copyFile(from, to);
  await fsApi("copyFile", { from, to });
}

export async function remove(
  path: string,
  options?: { recursive?: boolean },
): Promise<void> {
  if (isTauri) return tauriFs.remove(path, options);
  await fsApi("remove", { path, recursive: options?.recursive ?? false });
}
