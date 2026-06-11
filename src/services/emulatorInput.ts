import { join } from "@tauri-apps/api/path";
import {
  copyFile,
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { loadRuntimeIniConfig } from "./iniConfig";
import type { InGameButton, InGameMapping } from "./gamepad";

// RetroArch: cada botão do RetroPad -> índice físico do controle.
const RA_KEYS: [string, InGameButton][] = [
  ["input_player1_b_btn", "south"],
  ["input_player1_a_btn", "east"],
  ["input_player1_y_btn", "west"],
  ["input_player1_x_btn", "north"],
  ["input_player1_l_btn", "l1"],
  ["input_player1_r_btn", "r1"],
  ["input_player1_l2_btn", "l2"],
  ["input_player1_r2_btn", "r2"],
  ["input_player1_select_btn", "select"],
  ["input_player1_start_btn", "start"],
  ["input_player1_up_btn", "up"],
  ["input_player1_down_btn", "down"],
  ["input_player1_left_btn", "left"],
  ["input_player1_right_btn", "right"],
];

async function applyToRetroArch(
  base: string,
  m: InGameMapping,
): Promise<string | null> {
  const raDir = await join(base, "Emulators", "RetroArch");
  if (!(await exists(raDir))) return null;

  const cfgPath = await join(raDir, "retroarch.cfg");
  let lines: string[] = [];
  if (await exists(cfgPath)) {
    lines = (await readTextFile(cfgPath)).split(/\r?\n/);
  }

  const ours = new Map<string, string>();
  for (const [key, btn] of RA_KEYS) ours.set(key, String(m[btn]));
  ours.set("input_player1_joypad_index", "0");

  const keys = new Set(ours.keys());
  const kept = lines.filter((l) => {
    const k = l.split("=")[0]?.trim();
    return l.trim() !== "" && (!k || !keys.has(k));
  });

  const appended = [...ours.entries()].map(([k, v]) => `${k} = "${v}"`);
  const out = [
    ...kept,
    "",
    "# Mapeamento de controle (fliperama admin)",
    ...appended,
    "",
  ].join("\n");

  await writeTextFile(cfgPath, out);
  return cfgPath;
}

async function applyToMame(
  base: string,
  m: InGameMapping,
): Promise<string | null> {
  const mameDir = await join(base, "Emulators", "MAME");
  if (!(await exists(mameDir))) return null;

  const cfgDir = await join(mameDir, "cfg");
  if (!(await exists(cfgDir))) await mkdir(cfgDir, { recursive: true });

  const cfgPath = await join(cfgDir, "default.cfg");
  if (await exists(cfgPath)) {
    // Backup do default.cfg antes de sobrescrever (reversível).
    await copyFile(cfgPath, await join(cfgDir, "default.cfg.bak")).catch(
      () => {},
    );
  }

  const jb = (index: number) => `JOYCODE_1_BUTTON${index + 1}`;
  const xml = `<?xml version="1.0"?>
<mameconfig version="10">
    <system name="default">
        <input>
            <port type="P1_BUTTON1"><newseq type="standard">${jb(m.south)}</newseq></port>
            <port type="P1_BUTTON2"><newseq type="standard">${jb(m.east)}</newseq></port>
            <port type="P1_BUTTON3"><newseq type="standard">${jb(m.west)}</newseq></port>
            <port type="P1_BUTTON4"><newseq type="standard">${jb(m.north)}</newseq></port>
            <port type="P1_BUTTON5"><newseq type="standard">${jb(m.l1)}</newseq></port>
            <port type="P1_BUTTON6"><newseq type="standard">${jb(m.r1)}</newseq></port>
            <port type="START1"><newseq type="standard">${jb(m.start)}</newseq></port>
            <port type="COIN1"><newseq type="standard">${jb(m.select)}</newseq></port>
            <port type="P1_JOYSTICK_UP"><newseq type="standard">JOYCODE_1_HAT1UP OR JOYCODE_1_YAXIS_UP_SWITCH</newseq></port>
            <port type="P1_JOYSTICK_DOWN"><newseq type="standard">JOYCODE_1_HAT1DOWN OR JOYCODE_1_YAXIS_DOWN_SWITCH</newseq></port>
            <port type="P1_JOYSTICK_LEFT"><newseq type="standard">JOYCODE_1_HAT1LEFT OR JOYCODE_1_XAXIS_LEFT_SWITCH</newseq></port>
            <port type="P1_JOYSTICK_RIGHT"><newseq type="standard">JOYCODE_1_HAT1RIGHT OR JOYCODE_1_XAXIS_RIGHT_SWITCH</newseq></port>
        </input>
    </system>
</mameconfig>
`;
  await writeTextFile(cfgPath, xml);
  return cfgPath;
}

export type ApplyResult = {
  applied: string[]; // descrições do que foi escrito
  skipped: string[]; // emuladores não encontrados
};

/**
 * Gera os configs de input dos emuladores a partir do mapeamento in-game.
 * RetroArch (10 plataformas) é confiável; MAME é best-effort (com backup) e
 * pode ser ajustado pelo menu Tab do próprio MAME.
 */
export async function applyInGameMapping(
  mapping: InGameMapping,
): Promise<ApplyResult> {
  const ini = await loadRuntimeIniConfig();
  const base = ini.hyperspinBasePath;
  const applied: string[] = [];
  const skipped: string[] = [];

  const ra = await applyToRetroArch(base, mapping).catch(() => null);
  if (ra) applied.push("RetroArch (retroarch.cfg) — 10 plataformas");
  else skipped.push("RetroArch (pasta não encontrada)");

  const mame = await applyToMame(base, mapping).catch(() => null);
  if (mame) applied.push("MAME (cfg/default.cfg, com backup) — best-effort");
  else skipped.push("MAME (pasta não encontrada)");

  return { applied, skipped };
}
