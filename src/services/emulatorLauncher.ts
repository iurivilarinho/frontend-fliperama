import { invoke } from "@tauri-apps/api/core";
import { getPlatformRuntimeConfig } from "./platformRuntimeConfig";
import { resolveMameExe } from "./mameRoute";

export async function launchSelectedGame(params: {
  platformName: string;
  romName: string;
  romPath: string;
}) {
  const runtimeConfig = await getPlatformRuntimeConfig(params.platformName);

  if (!runtimeConfig) {
    throw new Error(
      `Plataforma sem emulador configurado: ${params.platformName}`,
    );
  }

  console.log("launchSelectedGame", {
    platformName: params.platformName,
    launchProfile: runtimeConfig.launchProfile,
    emulatorPath: runtimeConfig.emulatorPath,
    romsDir: runtimeConfig.romsDir,
    romName: params.romName,
    romPath: params.romPath,
  });

  if (runtimeConfig.launchProfile === "mame") {
    // Acervo misto: alguns jogos só rodam no MAME 0.142 (mame_legacy.exe).
    const mamePath = await resolveMameExe(
      runtimeConfig.emulatorPath,
      params.romName,
    );
    await invoke("launch_mame", {
      mamePath,
      romName: params.romName,
      romsDir: runtimeConfig.romsDir,
    });
    return;
  }

  if (runtimeConfig.launchProfile === "retroarch") {
    if (!runtimeConfig.corePath) {
      throw new Error(
        `Core do RetroArch não configurado para: ${params.platformName}`,
      );
    }

    await invoke("launch_retroarch", {
      retroarchPath: runtimeConfig.emulatorPath,
      corePath: runtimeConfig.corePath,
      romPath: params.romPath,
    });
    return;
  }

  // Perfil genérico: emuladores standalone que recebem o caminho da ROM como
  // argumento, com argumentos extras opcionais (ex.: PCSX2 -batch -fullscreen).
  await invoke("launch_generic", {
    emulatorPath: runtimeConfig.emulatorPath,
    romPath: params.romPath,
    args: runtimeConfig.launchArgs,
  });
}
