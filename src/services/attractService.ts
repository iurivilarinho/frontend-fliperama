import { listCatalogPlatformNames } from "./platformCatalog";
import { listHyperspinGames } from "./hyperspinGamesService";

export type AttractItem = {
  name: string;
  platform: string;
  imageUrl: string | null;
  videoUrl: string | null;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  // Fisher-Yates determinístico o suficiente (sem Math.random proibido em alguns
  // contextos; aqui no front é permitido).
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Coleta jogos COM mídia (vídeo/snap/wheel) de várias plataformas para o modo
 * atrair. Para assim que junta `maxItems` — não varre tudo, para ser rápido.
 */
export async function loadAttractItems(maxItems = 40): Promise<AttractItem[]> {
  const names = shuffle(await listCatalogPlatformNames());
  const items: AttractItem[] = [];

  for (const platform of names) {
    if (items.length >= maxItems) break;
    try {
      const games = await listHyperspinGames({ platformName: platform });
      for (const g of games) {
        const imageUrl = g.backgroundImageUrl ?? g.wheelImageUrl;
        if (g.videoUrl || imageUrl) {
          items.push({
            name: g.description,
            platform,
            imageUrl,
            videoUrl: g.videoUrl,
          });
        }
      }
    } catch {
      // plataforma sem banco/mídia: ignora
    }
  }

  return shuffle(items).slice(0, maxItems);
}
