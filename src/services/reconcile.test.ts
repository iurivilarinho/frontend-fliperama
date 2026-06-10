import { describe, expect, it } from "vitest";
import { reconcileNames } from "./reconcile";

describe("reconcileNames", () => {
  it("identifica casados, faltantes e órfãos (case-insensitive)", () => {
    const games = ["Sonic", "Aladdin", "Comix Zone"];
    const roms = ["sonic", "aladdin", "vectorman"];
    const r = reconcileNames(games, roms);

    expect(r.matched).toBe(2);
    expect(r.missingRoms).toEqual(["Comix Zone"]);
    expect(r.orphanRoms).toEqual(["vectorman"]);
    expect(r.occupancyPct).toBe(67);
  });

  it("100% quando todos os jogos têm ROM", () => {
    const r = reconcileNames(["a", "b"], ["a", "b", "c"]);
    expect(r.matched).toBe(2);
    expect(r.missingRoms).toEqual([]);
    expect(r.orphanRoms).toEqual(["c"]);
    expect(r.occupancyPct).toBe(100);
  });

  it("0% e sem divisão por zero quando não há jogos", () => {
    const r = reconcileNames([], ["x"]);
    expect(r.matched).toBe(0);
    expect(r.occupancyPct).toBe(0);
    expect(r.orphanRoms).toEqual(["x"]);
  });
});
