import { describe, expect, it } from "vitest";
import {
  getExtension,
  isExtensionAllowed,
  normalizeExtensions,
  removeExtension,
} from "./uploadRules";

describe("normalizeExtensions", () => {
  it("normaliza para minúsculo e garante o ponto", () => {
    expect(normalizeExtensions(["ZIP", ".7z", " smc "])).toEqual([
      ".zip",
      ".7z",
      ".smc",
    ]);
  });
  it("ignora vazios", () => {
    expect(normalizeExtensions(["", "  ", ".gba"])).toEqual([".gba"]);
  });
});

describe("getExtension / removeExtension", () => {
  it("extrai a extensão em minúsculo", () => {
    expect(getExtension("Mario (USA).SMC")).toBe(".smc");
    expect(getExtension("sem-extensao")).toBe("");
  });
  it("remove a extensão", () => {
    expect(removeExtension("Sonic (USA).bin")).toBe("Sonic (USA)");
    expect(removeExtension("007 - GoldenEye (USA).z64")).toBe(
      "007 - GoldenEye (USA)",
    );
  });
});

describe("isExtensionAllowed", () => {
  const allowed = [".cue", ".bin", ".chd"];
  it("aceita extensão permitida (case-insensitive)", () => {
    expect(isExtensionAllowed("jogo.CHD", allowed)).toBe(true);
    expect(isExtensionAllowed("jogo.bin", allowed)).toBe(true);
  });
  it("rejeita extensão não permitida ou ausente", () => {
    expect(isExtensionAllowed("jogo.iso", allowed)).toBe(false);
    expect(isExtensionAllowed("jogo", allowed)).toBe(false);
  });
  it("normaliza extensões sem ponto na lista", () => {
    expect(isExtensionAllowed("rom.smc", ["smc", "sfc"])).toBe(true);
  });
});
