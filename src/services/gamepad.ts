// Detecção e mapeamento de controles (Web Gamepad API). Configuração GLOBAL:
// um painel físico para o totem inteiro. As ações são traduzidas para as teclas
// que as telas já escutam (ponte gamepad -> teclado).

export type ControllerType = "playstation" | "xbox" | "generic";

export type ControlAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "back"
  | "favorite"
  | "search";

export const CONTROL_ACTIONS: { action: ControlAction; label: string; key: string }[] = [
  { action: "up", label: "Cima", key: "ArrowUp" },
  { action: "down", label: "Baixo", key: "ArrowDown" },
  { action: "left", label: "Esquerda", key: "ArrowLeft" },
  { action: "right", label: "Direita", key: "ArrowRight" },
  { action: "confirm", label: "Confirmar / Jogar", key: "Enter" },
  { action: "back", label: "Voltar", key: "Escape" },
  { action: "favorite", label: "Favoritar", key: "f" },
  { action: "search", label: "Buscar", key: "/" },
];

export type ControlMapping = Record<ControlAction, number>;

// Mapeamento padrão (índices do "Standard Gamepad" do W3C — vale para a maioria
// dos controles de PS, Xbox e genéricos reconhecidos como standard).
export const DEFAULT_MAPPING: ControlMapping = {
  confirm: 0, // A / Cross
  back: 1, // B / Circle
  favorite: 2, // X / Square
  search: 3, // Y / Triangle
  up: 12, // D-pad cima
  down: 13, // D-pad baixo
  left: 14, // D-pad esquerda
  right: 15, // D-pad direita
};

export function detectControllerType(id: string): ControllerType {
  const s = id.toLowerCase();
  if (
    s.includes("dualshock") ||
    s.includes("dualsense") ||
    s.includes("sony") ||
    s.includes("playstation") ||
    s.includes("054c") || // vendor Sony
    s.includes("0ce6") // DualSense product
  ) {
    return "playstation";
  }
  if (
    s.includes("xbox") ||
    s.includes("xinput") ||
    s.includes("microsoft") ||
    s.includes("045e") // vendor Microsoft
  ) {
    return "xbox";
  }
  return "generic";
}

export const CONTROLLER_LABEL: Record<ControllerType, string> = {
  playstation: "PlayStation",
  xbox: "Xbox",
  generic: "Genérico",
};

export type ConnectedController = {
  index: number;
  id: string;
  type: ControllerType;
  buttons: number;
  axes: number;
};

export function listConnectedControllers(): ConnectedController[] {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return [];
  const pads = navigator.getGamepads();
  const out: ConnectedController[] = [];
  for (const pad of pads) {
    if (!pad) continue;
    out.push({
      index: pad.index,
      id: pad.id,
      type: detectControllerType(pad.id),
      buttons: pad.buttons.length,
      axes: pad.axes.length,
    });
  }
  return out;
}

/** Botões pressionados agora (índices) somando todos os controles conectados. */
export function readPressedButtons(): Set<number> {
  const pressed = new Set<number>();
  if (typeof navigator === "undefined" || !navigator.getGamepads) return pressed;
  for (const pad of navigator.getGamepads()) {
    if (!pad) continue;
    pad.buttons.forEach((b, i) => {
      if (b.pressed || b.value > 0.5) pressed.add(i);
    });
  }
  return pressed;
}

/** Direção do analógico esquerdo (eixos 0/1) combinada de todos os controles. */
export function readStickDirection(): { up: boolean; down: boolean; left: boolean; right: boolean } {
  const dir = { up: false, down: false, left: false, right: false };
  if (typeof navigator === "undefined" || !navigator.getGamepads) return dir;
  const T = 0.55;
  for (const pad of navigator.getGamepads()) {
    if (!pad || pad.axes.length < 2) continue;
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    if (y < -T) dir.up = true;
    if (y > T) dir.down = true;
    if (x < -T) dir.left = true;
    if (x > T) dir.right = true;
  }
  return dir;
}
