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

// ── Mapeamento dentro do jogo (botões do controle nos emuladores) ──────────
export type InGameButton =
  | "south"
  | "east"
  | "west"
  | "north"
  | "l1"
  | "r1"
  | "l2"
  | "r2"
  | "select"
  | "start"
  | "up"
  | "down"
  | "left"
  | "right";

export const INGAME_BUTTONS: { key: InGameButton; label: string }[] = [
  { key: "south", label: "A / ✕ (baixo)" },
  { key: "east", label: "B / ○ (direita)" },
  { key: "west", label: "X / □ (esquerda)" },
  { key: "north", label: "Y / △ (cima)" },
  { key: "l1", label: "L1 / LB" },
  { key: "r1", label: "R1 / RB" },
  { key: "l2", label: "L2 / LT" },
  { key: "r2", label: "R2 / RT" },
  { key: "select", label: "Select / Share" },
  { key: "start", label: "Start / Options" },
  { key: "up", label: "D-pad cima" },
  { key: "down", label: "D-pad baixo" },
  { key: "left", label: "D-pad esquerda" },
  { key: "right", label: "D-pad direita" },
];

export type InGameMapping = Record<InGameButton, number>;

// Layout padrão de um "Standard Gamepad" (W3C).
export const DEFAULT_INGAME_MAPPING: InGameMapping = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  l1: 4,
  r1: 5,
  l2: 6,
  r2: 7,
  select: 8,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
};

// ── Presets prontos (a pessoa escolhe e ajusta se quiser) ──────────────────
export type ControlPreset = {
  id: string;
  label: string;
  description: string;
  nav: ControlMapping;
  ingame: InGameMapping;
};

// Xbox, PlayStation e PC compartilham o "Standard Gamepad" (o Chromium
// normaliza os índices): ✕/A=0, ○/B=1, □/X=2, △/Y=3. Mudam os rótulos, não os
// índices. O Fliperama (encoder de arcade) costuma diferir e quase sempre
// precisa de ajuste fino.
export const CONTROL_PRESETS: ControlPreset[] = [
  {
    id: "pc",
    label: "PC (teclado + gamepad)",
    description:
      "Layout padrão. O teclado já funciona nativo (setas/Enter/Esc); se plugar um gamepad, usa este layout.",
    nav: { ...DEFAULT_MAPPING },
    ingame: { ...DEFAULT_INGAME_MAPPING },
  },
  {
    id: "xbox",
    label: "Xbox",
    description: "A = confirmar, B = voltar. Layout padrão do controle Xbox.",
    nav: { ...DEFAULT_MAPPING },
    ingame: { ...DEFAULT_INGAME_MAPPING },
  },
  {
    id: "playstation",
    label: "PlayStation",
    description:
      "✕ = confirmar, ○ = voltar. Mesmos índices do padrão (DualShock/DualSense normalizados).",
    nav: { ...DEFAULT_MAPPING },
    ingame: { ...DEFAULT_INGAME_MAPPING },
  },
  {
    id: "fliperama",
    label: "Fliperama (arcade)",
    description:
      "Encoder de arcade (zero-delay): 6 botões + start/coin. Confira com 'aperte para vincular' — encoders variam.",
    nav: { confirm: 1, back: 2, favorite: 0, search: 3, up: 12, down: 13, left: 14, right: 15 },
    ingame: {
      south: 1,
      east: 2,
      west: 0,
      north: 3,
      l1: 4,
      r1: 5,
      l2: 6,
      r2: 7,
      select: 8, // coin
      start: 9,
      up: 12,
      down: 13,
      left: 14,
      right: 15,
    },
  },
];

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
