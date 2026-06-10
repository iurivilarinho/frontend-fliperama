// Lógica pura de reconciliação entre jogos do banco e ROMs no disco.

export type ReconcileResult = {
  matched: number;
  missingRoms: string[]; // jogos do banco sem ROM
  orphanRoms: string[]; // ROMs sem jogo no banco
  occupancyPct: number;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Compara os nomes de jogos do banco com os nomes-base dos arquivos de ROM.
 * @param gameNames nomes (atributo `name`) dos jogos no banco
 * @param romBaseNames nomes-base (sem extensão) dos arquivos de ROM no disco
 */
export function reconcileNames(
  gameNames: string[],
  romBaseNames: string[],
): ReconcileResult {
  const romKeys = new Set(romBaseNames.map(normalizeKey));
  const gameKeys = new Set(gameNames.map(normalizeKey));

  let matched = 0;
  const missingRoms: string[] = [];
  for (const name of gameNames) {
    if (romKeys.has(normalizeKey(name))) matched += 1;
    else missingRoms.push(name);
  }

  const orphanRoms: string[] = [];
  for (const rom of romBaseNames) {
    if (!gameKeys.has(normalizeKey(rom))) orphanRoms.push(rom);
  }

  return {
    matched,
    missingRoms: missingRoms.sort((a, b) => a.localeCompare(b)),
    orphanRoms: orphanRoms.sort((a, b) => a.localeCompare(b)),
    occupancyPct:
      gameNames.length > 0
        ? Math.round((matched / gameNames.length) * 100)
        : 0,
  };
}
