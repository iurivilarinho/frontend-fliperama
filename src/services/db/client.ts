import Database from "@tauri-apps/plugin-sql";
import { apiBase, isTauri } from "../remoteHost";

const DB_URL = "sqlite:fliperama.db";

// No app (Tauri) usamos o plugin SQL local. Num navegador remoto (outra máquina
// na rede acessando o painel via web) não há runtime Tauri — então roteamos as
// queries para o servidor HTTP embarcado no host (ver ../remoteHost).

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
}

async function apiCall<T>(
  path: string,
  query: string,
  params: unknown[],
): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql: query, params }),
  });
  if (!response.ok) {
    throw new Error(`API ${path} falhou: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function select<T>(
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!isTauri) return apiCall<T[]>("/api/db/select", query, params);
  const db = await getDb();
  return db.select<T[]>(query, params);
}

export async function execute(
  query: string,
  params: unknown[] = [],
): Promise<{ rowsAffected: number; lastInsertId?: number }> {
  if (!isTauri) {
    return apiCall<{ rowsAffected: number; lastInsertId?: number }>(
      "/api/db/execute",
      query,
      params,
    );
  }
  const db = await getDb();
  return db.execute(query, params);
}
