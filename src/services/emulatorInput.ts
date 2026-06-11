import { join } from "./path";
import {
  copyFile,
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "./fs";
import { loadRuntimeIniConfig } from "./iniConfig";
import type { InGameButton, InGameMapping } from "./gamepad";
import { loadInGameMapping, loadNumPlayers } from "./db/controls";
import {
  getBezelEnabled,
  getCrtShaderEnabled,
  getRaConfig,
} from "./db/settings";
import { xinputBind } from "./xinputMapping";

// RetroArch: sufixo do RetroPad -> botão lógico do nosso mapeamento.
const RA_BTNS: [string, InGameButton][] = [
  ["b", "south"],
  ["a", "east"],
  ["y", "west"],
  ["x", "north"],
  ["l", "l1"],
  ["r", "r1"],
  ["l2", "l2"],
  ["r2", "r2"],
  ["select", "select"],
  ["start", "start"],
  ["up", "up"],
  ["down", "down"],
  ["left", "left"],
  ["right", "right"],
];

// xinputBind: tradução browser->XInput, em ./xinputMapping (módulo puro/testável).

async function applyToRetroArch(
  base: string,
  m: InGameMapping,
  numPlayers: number,
): Promise<string | null> {
  const raDir = await join(base, "Emulators", "RetroArch");
  if (!(await exists(raDir))) return null;

  const cfgPath = await join(raDir, "retroarch.cfg");
  let lines: string[] = [];
  if (await exists(cfgPath)) {
    lines = (await readTextFile(cfgPath)).split(/\r?\n/);
  }

  const ours = new Map<string, string>();
  for (let p = 1; p <= numPlayers; p++) {
    for (const [ra, btn] of RA_BTNS) {
      const bind = xinputBind(m[btn]);
      ours.set(`input_player${p}_${ra}_${bind.suffix}`, bind.value);
    }
    // Cada jogador usa um controle: P1 = controle 0, P2 = controle 1, ...
    ours.set(`input_player${p}_joypad_index`, String(p - 1));
  }

  // Tela cheia (totem) + sair do RetroArch com o botão de menu não fecha sozinho.
  ours.set("video_fullscreen", "true");
  ours.set("video_windowed_fullscreen", "true");
  ours.set("pause_nonactive", "false");

  // Visual: shader CRT (scanlines) e bezel (moldura). Caminhos com barra normal
  // (o RetroArch aceita no Windows). Ligados/desligados pelos parâmetros do admin.
  const raDirSlash = raDir.replace(/\\/g, "/");
  const [shaderOn, bezelOn] = await Promise.all([
    getCrtShaderEnabled().catch(() => false),
    getBezelEnabled().catch(() => false),
  ]);
  if (shaderOn) {
    ours.set("video_shader_enable", "true");
    ours.set(
      "video_shader",
      `${raDirSlash}/shaders/shaders_glsl/crt/crt-easymode.glslp`,
    );
  } else {
    ours.set("video_shader_enable", "false");
  }
  if (bezelOn) {
    ours.set("input_overlay_enable", "true");
    ours.set(
      "input_overlay",
      `${raDirSlash}/overlays/effects/crt-bezels/horizontal.cfg`,
    );
    ours.set("input_overlay_opacity", "1.000000");
    ours.set("input_overlay_hide_in_menu", "false");
  } else {
    ours.set("input_overlay_enable", "false");
  }

  // RetroAchievements (cheevos): conta do operador. Liga as conquistas in-game
  // do RetroArch para consoles e arcade via core. Senha em texto é como o
  // próprio RetroArch armazena; ele troca por token no primeiro login.
  const ra = await getRaConfig().catch(() => null);
  if (ra && ra.enabled && ra.username) {
    ours.set("cheevos_enable", "true");
    ours.set("cheevos_username", ra.username);
    ours.set("cheevos_password", ra.password);
    ours.set("cheevos_hardcore_mode_enable", ra.hardcore ? "true" : "false");
    ours.set("cheevos_richpresence_enable", "true");
    ours.set("cheevos_challenge_indicators", "true");
    ours.set("cheevos_unlock_sound_enable", "true");
  } else {
    ours.set("cheevos_enable", "false");
  }

  // Teclado do jogador 1 — movimento WASD + botões em DIAMANTE (mesma geometria
  // de um controle: cima/esq/baixo/dir = X/Y/B/A), para quem joga no teclado.
  const kb: Record<string, string> = {
    input_player1_up: "w",
    input_player1_down: "s",
    input_player1_left: "a",
    input_player1_right: "d",
    input_player1_x: "i", // cima
    input_player1_y: "j", // esquerda
    input_player1_b: "k", // baixo (ação principal)
    input_player1_a: "l", // direita
    input_player1_l: "u", // L1
    input_player1_r: "o", // R1
    input_player1_l2: "y", // L2
    input_player1_r2: "p", // R2
    input_player1_start: "enter",
    input_player1_select: "rshift",
  };
  for (const [k, val] of Object.entries(kb)) ours.set(k, val);

  // Trava de totem: desabilita atalhos do RetroArch que ROUBAM teclas do jogador
  // (frame advance, fast-forward, rewind, etc.). Como input_enable_hotkey = nul,
  // esses atalhos ficam sempre ativos e, por padrão, usam letras (k, l, espaço...)
  // que colidem com os botões do jogo. Desligando-os, as teclas só fazem o jogo.
  for (const hk of [
    "input_toggle_fullscreen",
    "input_screenshot",
    "input_state_slot_increase",
    "input_state_slot_decrease",
    "input_frame_advance",
    "input_hold_fast_forward",
    "input_toggle_fast_forward",
    "input_rewind",
    "input_reset",
    "input_load_state",
    "input_save_state",
    "input_hold_slowmotion",
    "input_toggle_slowmotion",
  ]) {
    ours.set(hk, "nul");
  }

  const keys = new Set(ours.keys());
  // Remove binds de controle ANTIGOS (botão/eixo) para não sobrar índice errado
  // do esquema anterior conflitando com os novos (XInput).
  const oldJoypadBind = /^input_player\d+_[a-z0-9]+_(btn|axis)$/;
  const kept = lines.filter((l) => {
    const k = l.split("=")[0]?.trim();
    if (l.trim() === "") return false;
    if (k && keys.has(k)) return false;
    if (k && oldJoypadBind.test(k)) return false;
    return true;
  });

  const appended = [...ours.entries()].map(([k, v]) => `${k} = "${v}"`);
  const out = [
    ...kept,
    "",
    `# Mapeamento de controle (fliperama admin) — ${numPlayers} jogador(es)`,
    ...appended,
    "",
  ].join("\n");

  await writeTextFile(cfgPath, out);
  return cfgPath;
}

async function applyToMame(
  base: string,
  m: InGameMapping,
  numPlayers: number,
): Promise<string | null> {
  const mameDir = await join(base, "Emulators", "MAME");
  if (!(await exists(mameDir))) return null;

  const cfgDir = await join(mameDir, "cfg");
  if (!(await exists(cfgDir))) await mkdir(cfgDir, { recursive: true });

  const cfgPath = await join(cfgDir, "default.cfg");
  if (await exists(cfgPath)) {
    await copyFile(cfgPath, await join(cfgDir, "default.cfg.bak")).catch(
      () => {},
    );
  }

  const jb = (player: number, index: number) =>
    `JOYCODE_${player}_BUTTON${index + 1}`;

  let ports = "";
  for (let p = 1; p <= numPlayers; p++) {
    ports += `
            <port type="P${p}_BUTTON1"><newseq type="standard">${jb(p, m.south)}</newseq></port>
            <port type="P${p}_BUTTON2"><newseq type="standard">${jb(p, m.east)}</newseq></port>
            <port type="P${p}_BUTTON3"><newseq type="standard">${jb(p, m.west)}</newseq></port>
            <port type="P${p}_BUTTON4"><newseq type="standard">${jb(p, m.north)}</newseq></port>
            <port type="P${p}_BUTTON5"><newseq type="standard">${jb(p, m.l1)}</newseq></port>
            <port type="P${p}_BUTTON6"><newseq type="standard">${jb(p, m.r1)}</newseq></port>
            <port type="START${p}"><newseq type="standard">KEYCODE_${p} OR ${jb(p, m.start)}</newseq></port>
            <port type="COIN${p}"><newseq type="standard">KEYCODE_${p + 4} OR ${jb(p, m.select)}</newseq></port>
            <port type="P${p}_JOYSTICK_UP"><newseq type="standard">JOYCODE_${p}_HAT1UP OR JOYCODE_${p}_YAXIS_UP_SWITCH</newseq></port>
            <port type="P${p}_JOYSTICK_DOWN"><newseq type="standard">JOYCODE_${p}_HAT1DOWN OR JOYCODE_${p}_YAXIS_DOWN_SWITCH</newseq></port>
            <port type="P${p}_JOYSTICK_LEFT"><newseq type="standard">JOYCODE_${p}_HAT1LEFT OR JOYCODE_${p}_XAXIS_LEFT_SWITCH</newseq></port>
            <port type="P${p}_JOYSTICK_RIGHT"><newseq type="standard">JOYCODE_${p}_HAT1RIGHT OR JOYCODE_${p}_XAXIS_RIGHT_SWITCH</newseq></port>`;
  }

  const xml = `<?xml version="1.0"?>
<mameconfig version="10">
    <system name="default">
        <input>${ports}
        </input>
    </system>
</mameconfig>
`;
  await writeTextFile(cfgPath, xml);
  return cfgPath;
}

export type ApplyResult = {
  applied: string[];
  skipped: string[];
};

/**
 * Gera os configs de input dos emuladores a partir do mapeamento in-game, para
 * `numPlayers` jogadores (cada um num controle).
 */
export async function applyInGameMapping(
  mapping: InGameMapping,
  numPlayers = 1,
): Promise<ApplyResult> {
  const ini = await loadRuntimeIniConfig();
  const base = ini.hyperspinBasePath;
  const players = Math.min(4, Math.max(1, numPlayers));
  const applied: string[] = [];
  const skipped: string[] = [];

  const ra = await applyToRetroArch(base, mapping, players).catch(() => null);
  if (ra) applied.push(`RetroArch (retroarch.cfg) — ${players} jogador(es)`);
  else skipped.push("RetroArch (pasta não encontrada)");

  const mame = await applyToMame(base, mapping, players).catch(() => null);
  if (mame)
    applied.push(`MAME (cfg/default.cfg, com backup) — ${players} jogador(es)`);
  else skipped.push("MAME (pasta não encontrada)");

  return { applied, skipped };
}

/**
 * Aplica o mapeamento de controle SALVO (banco) aos emuladores. Chamado no boot
 * do totem para garantir que, mesmo num RetroArch novo/limpo, os binds corretos
 * e as travas de atalho (fast-forward, frame advance, etc.) estejam sempre lá —
 * sem o operador precisar lembrar de clicar em "Aplicar".
 */
export async function applySavedInGameMapping(): Promise<ApplyResult> {
  const [mapping, numPlayers] = await Promise.all([
    loadInGameMapping(),
    loadNumPlayers(),
  ]);
  return applyInGameMapping(mapping, numPlayers);
}
