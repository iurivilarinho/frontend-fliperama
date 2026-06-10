import { execute } from "./client";

/**
 * Registra o lançamento de um jogo: cria um evento de uso e incrementa as
 * estatísticas do jogo (play_count / last_played_at). Alimenta os módulos de
 * financeiro, uso e "mais jogados". Silencioso se o banco não estiver pronto.
 */
export async function recordGameLaunch(params: {
  platformName: string;
  romName: string;
  sessionId?: number | null;
}): Promise<void> {
  const now = new Date().toISOString();
  try {
    await execute(
      "INSERT INTO usage_events (session_id, platform_name, rom_name, started_at) VALUES (?, ?, ?, ?)",
      [params.sessionId ?? null, params.platformName, params.romName, now],
    );

    await execute(
      "INSERT INTO game_stats (platform_name, rom_name, favorite, play_count, last_played_at) " +
        "VALUES (?, ?, 0, 1, ?) " +
        "ON CONFLICT(platform_name, rom_name) DO UPDATE SET " +
        "play_count = play_count + 1, last_played_at = excluded.last_played_at",
      [params.platformName, params.romName, now],
    );
  } catch (error) {
    console.warn("DB indisponível ao registrar uso:", error);
  }
}
