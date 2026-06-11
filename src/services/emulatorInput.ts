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
      ours.set(`input_player${p}_${ra}_btn`, String(m[btn]));
    }
    // Cada jogador usa um controle: P1 = controle 0, P2 = controle 1, ...
    ours.set(`input_player${p}_joypad_index`, String(p - 1));
  }

  const keys = new Set(ours.keys());
  const kept = lines.filter((l) => {
    const k = l.split("=")[0]?.trim();
    return l.trim() !== "" && (!k || !keys.has(k));
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
            <port type="START${p}"><newseq type="standard">${jb(p, m.start)}</newseq></port>
            <port type="COIN${p}"><newseq type="standard">${jb(p, m.select)}</newseq></port>
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
