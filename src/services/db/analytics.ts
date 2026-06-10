import { select } from "./client";

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfWeekIso(): string {
  const d = new Date();
  const day = d.getDay(); // 0=dom
  const diff = (day + 6) % 7; // segunda como início
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function sumPaid(sinceIso?: string): Promise<number> {
  const where =
    "WHERE status IN ('approved','paid','accredited')" +
    (sinceIso ? " AND COALESCE(paid_at, created_at) >= ?" : "");
  const rows = await select<{ total: number | null }>(
    `SELECT COALESCE(SUM(amount_cents),0) AS total FROM payments ${where}`,
    sinceIso ? [sinceIso] : [],
  );
  return rows[0]?.total ?? 0;
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const rows = await select<{ n: number }>(sql, params);
  return rows[0]?.n ?? 0;
}

export type FinancialSummary = {
  revenueTodayCents: number;
  revenueWeekCents: number;
  revenueMonthCents: number;
  revenueTotalCents: number;
  payments: number;
  sessions: number;
  avgTicketCents: number;
  avgSessionMinutes: number;
  conversionPct: number;
};

export async function getFinancialSummary(): Promise<FinancialSummary> {
  const [today, week, month, total] = await Promise.all([
    sumPaid(startOfTodayIso()),
    sumPaid(startOfWeekIso()),
    sumPaid(startOfMonthIso()),
    sumPaid(),
  ]);

  const payments = await count(
    "SELECT COUNT(*) AS n FROM payments WHERE status IN ('approved','paid','accredited')",
  );
  const sessions = await count("SELECT COUNT(*) AS n FROM sessions");
  const avgRows = await select<{ avg: number | null }>(
    "SELECT AVG(duration_minutes) AS avg FROM sessions",
  );

  return {
    revenueTodayCents: today,
    revenueWeekCents: week,
    revenueMonthCents: month,
    revenueTotalCents: total,
    payments,
    sessions,
    avgTicketCents: payments > 0 ? Math.round(total / payments) : 0,
    avgSessionMinutes: Math.round((avgRows[0]?.avg ?? 0) * 10) / 10,
    conversionPct:
      sessions > 0 ? Math.min(100, Math.round((payments / sessions) * 100)) : 0,
  };
}

export type RevenueByDay = { day: string; cents: number };

export async function getRevenueByDay(days = 14): Promise<RevenueByDay[]> {
  const rows = await select<{ day: string; cents: number }>(
    "SELECT substr(COALESCE(paid_at, created_at),1,10) AS day, COALESCE(SUM(amount_cents),0) AS cents " +
      "FROM payments WHERE status IN ('approved','paid','accredited') " +
      "GROUP BY day ORDER BY day DESC LIMIT ?",
    [days],
  );
  return rows.reverse();
}

export type PlatformUsage = { platform: string; launches: number };

export async function getUsageByPlatform(): Promise<PlatformUsage[]> {
  return select<PlatformUsage>(
    "SELECT platform_name AS platform, COUNT(*) AS launches FROM usage_events " +
      "GROUP BY platform_name ORDER BY launches DESC",
  );
}

export type MostPlayed = {
  platform_name: string;
  rom_name: string;
  play_count: number;
  last_played_at: string | null;
};

export async function getMostPlayed(limit = 15): Promise<MostPlayed[]> {
  return select<MostPlayed>(
    "SELECT platform_name, rom_name, play_count, last_played_at FROM game_stats " +
      "ORDER BY play_count DESC LIMIT ?",
    [limit],
  );
}

export type SessionsSummary = {
  active: number;
  ended: number;
  expired: number;
  today: number;
};

export async function getSessionsSummary(): Promise<SessionsSummary> {
  const [active, ended, expired, today] = await Promise.all([
    count("SELECT COUNT(*) AS n FROM sessions WHERE status = 'active'"),
    count("SELECT COUNT(*) AS n FROM sessions WHERE status = 'ended'"),
    count("SELECT COUNT(*) AS n FROM sessions WHERE status = 'expired'"),
    count("SELECT COUNT(*) AS n FROM sessions WHERE started_at >= ?", [
      startOfTodayIso(),
    ]),
  ]);
  return { active, ended, expired, today };
}

export type PaymentRow = {
  id: number;
  amount_cents: number;
  minutes: number;
  status: string;
  created_at: string;
  paid_at: string | null;
};

export async function getRecentPayments(limit = 20): Promise<PaymentRow[]> {
  return select<PaymentRow>(
    "SELECT id, amount_cents, minutes, status, created_at, paid_at FROM payments ORDER BY id DESC LIMIT ?",
    [limit],
  );
}

export type PeakHour = { hour: string; count: number };

export async function getPeakHours(): Promise<PeakHour[]> {
  const rows = await select<{ hour: string; count: number }>(
    "SELECT substr(started_at, 12, 2) AS hour, COUNT(*) AS count FROM usage_events " +
      "GROUP BY hour ORDER BY hour ASC",
  );
  return rows.filter((r) => r.hour);
}

export type UsageRow = {
  id: number;
  platform_name: string;
  rom_name: string;
  started_at: string;
};

export async function getRecentUsage(limit = 30): Promise<UsageRow[]> {
  return select<UsageRow>(
    "SELECT id, platform_name, rom_name, started_at FROM usage_events ORDER BY id DESC LIMIT ?",
    [limit],
  );
}
