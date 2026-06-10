import { execute, select } from "./client";

export type PricingTier = {
  id: number;
  minutes: number;
  priceCents: number;
  active: boolean;
  sortOrder: number;
};

type PricingRow = {
  id: number;
  minutes: number;
  price_cents: number;
  active: number;
  sort_order: number;
};

function mapRow(row: PricingRow): PricingTier {
  return {
    id: row.id,
    minutes: row.minutes,
    priceCents: row.price_cents,
    active: row.active === 1,
    sortOrder: row.sort_order,
  };
}

export async function listAllTiers(): Promise<PricingTier[]> {
  const rows = await select<PricingRow>(
    "SELECT * FROM pricing_tiers ORDER BY sort_order ASC, minutes ASC",
  );
  return rows.map(mapRow);
}

export async function listActiveTiers(): Promise<PricingTier[]> {
  const rows = await select<PricingRow>(
    "SELECT * FROM pricing_tiers WHERE active = 1 ORDER BY sort_order ASC, minutes ASC",
  );
  return rows.map(mapRow);
}

export async function createTier(
  minutes: number,
  priceCents: number,
): Promise<void> {
  const max = await select<{ m: number | null }>(
    "SELECT MAX(sort_order) AS m FROM pricing_tiers",
  );
  const nextOrder = (max[0]?.m ?? -1) + 1;
  await execute(
    "INSERT INTO pricing_tiers (minutes, price_cents, active, sort_order) VALUES (?, ?, 1, ?)",
    [minutes, priceCents, nextOrder],
  );
}

export async function updateTier(
  id: number,
  patch: Partial<Pick<PricingTier, "minutes" | "priceCents" | "active">>,
): Promise<void> {
  const current = await select<PricingRow>(
    "SELECT * FROM pricing_tiers WHERE id = ?",
    [id],
  );
  const row = current[0];
  if (!row) return;

  const minutes = patch.minutes ?? row.minutes;
  const priceCents = patch.priceCents ?? row.price_cents;
  const active = (patch.active ?? row.active === 1) ? 1 : 0;

  await execute(
    "UPDATE pricing_tiers SET minutes = ?, price_cents = ?, active = ? WHERE id = ?",
    [minutes, priceCents, active, id],
  );
}

export async function deleteTier(id: number): Promise<void> {
  await execute("DELETE FROM pricing_tiers WHERE id = ?", [id]);
}

/**
 * Calcula o preço (em centavos) para uma duração: usa correspondência exata
 * se houver faixa; senão interpola proporcionalmente pela faixa mais próxima.
 */
export function priceCentsForMinutes(
  tiers: PricingTier[],
  minutes: number,
): number {
  const exact = tiers.find((t) => t.minutes === minutes && t.active);
  if (exact) return exact.priceCents;

  const active = tiers.filter((t) => t.active && t.minutes > 0);
  if (active.length === 0) return 0;

  // proporcional pela faixa de maior tempo <= minutes (ou a menor disponível)
  const sorted = [...active].sort((a, b) => a.minutes - b.minutes);
  const base =
    [...sorted].reverse().find((t) => t.minutes <= minutes) ?? sorted[0];
  const perMinute = base.priceCents / base.minutes;
  return Math.round(perMinute * minutes);
}
