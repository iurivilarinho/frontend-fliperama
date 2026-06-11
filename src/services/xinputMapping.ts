// Tradução do índice de botão da Gamepad API do navegador para o "bind" do
// RetroArch no driver XInput. Os dois divergem: Start/Select são 7/6 (não 9/8),
// os gatilhos L2/R2 são EIXOS (não botões), e o d-pad é um HAT (h0), não os
// botões 12-15. Sem traduzir, Start/Select/gatilhos/d-pad ficam errados no jogo.

export type XInputBind = { suffix: "btn" | "axis"; value: string };

export function xinputBind(browserIdx: number): XInputBind {
  switch (browserIdx) {
    case 6:
      return { suffix: "axis", value: "+2" }; // LT (gatilho esquerdo)
    case 7:
      return { suffix: "axis", value: "-2" }; // RT (gatilho direito)
    case 8:
      return { suffix: "btn", value: "6" }; // Back/Select
    case 9:
      return { suffix: "btn", value: "7" }; // Start
    case 10:
      return { suffix: "btn", value: "8" }; // L3
    case 11:
      return { suffix: "btn", value: "9" }; // R3
    case 12:
      return { suffix: "btn", value: "h0up" };
    case 13:
      return { suffix: "btn", value: "h0down" };
    case 14:
      return { suffix: "btn", value: "h0left" };
    case 15:
      return { suffix: "btn", value: "h0right" };
    default:
      return { suffix: "btn", value: String(browserIdx) }; // 0-5 coincidem
  }
}
