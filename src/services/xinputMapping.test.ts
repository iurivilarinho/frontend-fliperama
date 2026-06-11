import { describe, it, expect } from "vitest";
import { xinputBind } from "./xinputMapping";

describe("xinputBind (Gamepad API do navegador -> driver XInput do RetroArch)", () => {
  it("botões de face e ombros (0-5) passam direto como botão", () => {
    for (let i = 0; i <= 5; i++) {
      expect(xinputBind(i)).toEqual({ suffix: "btn", value: String(i) });
    }
  });

  it("Select(8)->btn 6 e Start(9)->btn 7 (eram 8/9 e não funcionavam)", () => {
    expect(xinputBind(8)).toEqual({ suffix: "btn", value: "6" });
    expect(xinputBind(9)).toEqual({ suffix: "btn", value: "7" });
  });

  it("gatilhos L2(6)/R2(7) viram EIXOS, não botões", () => {
    expect(xinputBind(6)).toEqual({ suffix: "axis", value: "+2" });
    expect(xinputBind(7)).toEqual({ suffix: "axis", value: "-2" });
  });

  it("L3(10)/R3(11) viram btn 8/9", () => {
    expect(xinputBind(10)).toEqual({ suffix: "btn", value: "8" });
    expect(xinputBind(11)).toEqual({ suffix: "btn", value: "9" });
  });

  it("d-pad (12-15) vira HAT h0, não botões", () => {
    expect(xinputBind(12)).toEqual({ suffix: "btn", value: "h0up" });
    expect(xinputBind(13)).toEqual({ suffix: "btn", value: "h0down" });
    expect(xinputBind(14)).toEqual({ suffix: "btn", value: "h0left" });
    expect(xinputBind(15)).toEqual({ suffix: "btn", value: "h0right" });
  });
});
