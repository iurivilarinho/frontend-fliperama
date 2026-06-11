import { describe, it, expect } from "vitest";
import { jsJoin, jsBasename, jsDirname } from "./pathUtils";

describe("jsJoin (junção de caminhos da ponte remota)", () => {
  it("junta com o separador do host (Windows)", () => {
    expect(jsJoin("\\", ["D:", "HD", "fliperama"])).toBe("D:\\HD\\fliperama");
  });

  it("preserva o drive (não toca em ':')", () => {
    expect(jsJoin("\\", ["D:\\HyperSpin", "Emulators"])).toBe(
      "D:\\HyperSpin\\Emulators",
    );
  });

  it("colapsa barras duplicadas e mistas", () => {
    expect(jsJoin("\\", ["D:\\HD\\", "/sub//", "file.zip"])).toBe(
      "D:\\HD\\sub\\file.zip",
    );
  });

  it("ignora segmentos vazios", () => {
    expect(jsJoin("\\", ["a", "", "b"])).toBe("a\\b");
  });

  it("funciona com separador POSIX", () => {
    expect(jsJoin("/", ["home", "user", "roms"])).toBe("home/user/roms");
  });
});

describe("jsBasename", () => {
  it("pega o último segmento (Windows)", () => {
    expect(jsBasename("D:\\HD\\fliperama\\jogo.zip")).toBe("jogo.zip");
  });

  it("pega o último segmento (POSIX)", () => {
    expect(jsBasename("/home/user/roms/jogo.zip")).toBe("jogo.zip");
  });

  it("ignora barra final", () => {
    expect(jsBasename("D:\\HD\\pasta\\")).toBe("pasta");
  });

  it("string vazia -> vazio", () => {
    expect(jsBasename("")).toBe("");
  });
});

describe("jsDirname", () => {
  it("remove o último segmento (Windows)", () => {
    expect(jsDirname("\\", "D:\\HD\\fliperama\\jogo.zip")).toBe(
      "D:\\HD\\fliperama",
    );
  });

  it("remove o último segmento (POSIX)", () => {
    expect(jsDirname("/", "/home/user/roms/jogo.zip")).toBe("/home/user/roms");
  });
});
