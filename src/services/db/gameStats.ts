import { execute, select } from "./client";

export type GameStat = {
  favorite: boolean;
  playCount: number;
  lastPlayedAt: string | null;
};

type GameStatRow = {
  rom_name: string;
  favorite: number;
  play_count: number;
  last_played_at: string | null;
};

/** Estatísticas (favorito/contagem) por jogo de uma plataforma, keyed por rom_name. */
export async function getStatsForPlatform(
  platformName: string,
): Promise<Record<string, GameStat>> {
  try {
    const rows = await select<GameStatRow>(
      "SELECT rom_name, favorite, play_count, last_played_at FROM game_stats WHERE platform_name = ?",
      [platformName],
    );
    const out: Record<string, GameStat> = {};
    for (const r of rows) {
      out[r.rom_name] = {
        favorite: r.favorite === 1,
        playCount: r.play_count,
        lastPlayedAt: r.last_played_at,
      };
    }
    return out;
  } catch {
    return {};
  }
}

export async function setFavorite(
  platformName: string,
  romName: string,
  favorite: boolean,
): Promise<void> {
  try {
    await execute(
      "INSERT INTO game_stats (platform_name, rom_name, favorite, play_count) VALUES (?, ?, ?, 0) " +
        "ON CONFLICT(platform_name, rom_name) DO UPDATE SET favorite = excluded.favorite",
      [platformName, romName, favorite ? 1 : 0],
    );
  } catch (error) {
    console.warn("DB indisponível ao favoritar:", error);
  }
}
