import { describe, it, expect } from "vitest";
import { sha256Hex } from "./sha256";

describe("sha256Hex (JS puro, sem crypto.subtle)", () => {
  it("string vazia", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("'abc' (vetor conhecido)", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("'admin' — bate com o hash gerado por crypto.subtle (senhas antigas válidas)", () => {
    expect(sha256Hex("admin")).toBe(
      "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
    );
  });

  it("é determinístico", () => {
    expect(sha256Hex("Retro Nexus")).toBe(sha256Hex("Retro Nexus"));
  });

  it("entradas diferentes -> hashes diferentes", () => {
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });

  it("UTF-8 (acentos) produz 64 hex válidos", () => {
    const h = sha256Hex("configuração ção é ");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("entrada longa (> 1 bloco de 64 bytes)", () => {
    const long = "x".repeat(200);
    expect(sha256Hex(long)).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex(long)).toBe(sha256Hex(long));
  });
});
