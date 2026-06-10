import Database from "@tauri-apps/plugin-sql";

const DB_URL = "sqlite:fliperama.db";

let dbPromise: Promise<Database> | null = null;

/**
 * Carrega (uma única vez) a conexão SQLite local do totem.
 * As migrations rodam no backend (Rust) ao registrar o plugin.
 */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
}

export async function select<T>(
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(query, params);
}

export async function execute(
  query: string,
  params: unknown[] = [],
): Promise<{ rowsAffected: number; lastInsertId?: number }> {
  const db = await getDb();
  return db.execute(query, params);
}
