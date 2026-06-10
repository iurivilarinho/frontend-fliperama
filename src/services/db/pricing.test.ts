import { describe, expect, it } from "vitest";
import { priceCentsForMinutes, type PricingTier } from "./pricing";

const tier = (
  id: number,
  minutes: number,
  priceCents: number,
  active = true,
): PricingTier => ({ id, minutes, priceCents, active, sortOrder: id });

describe("priceCentsForMinutes", () => {
  const tiers = [tier(1, 5, 200), tier(2, 10, 300), tier(3, 15, 500)];

  it("usa correspondência exata quando existe", () => {
    expect(priceCentsForMinutes(tiers, 10)).toBe(300);
  });

  it("interpola proporcionalmente quando não há faixa exata", () => {
    // base = faixa de 10min (300c => 30c/min) para 12min => 360c
    expect(priceCentsForMinutes(tiers, 12)).toBe(360);
  });

  it("retorna 0 quando não há faixas ativas", () => {
    expect(priceCentsForMinutes([], 5)).toBe(0);
    expect(priceCentsForMinutes([tier(1, 5, 200, false)], 5)).toBe(0);
  });

  it("ignora faixas inativas na correspondência exata", () => {
    expect(priceCentsForMinutes([tier(1, 5, 200, false)], 7)).toBe(0);
  });
});
