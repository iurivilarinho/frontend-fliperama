import { useCallback, useEffect, useState } from "react";
import { Download, ImageDown } from "lucide-react";
import { AdminPageHeader } from "../AdminLayout";
import { Button, Select } from "../../../components/ui";
import { listCatalogPlatformNames } from "../../../services/platformCatalog";
import {
  scrapePlatformArt,
  scraperSupportsPlatform,
  type ScrapeProgress,
  type ScrapeResult,
} from "../../../services/scraperService";

export function ScraperPage() {
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ScrapeProgress | null>(null);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listCatalogPlatformNames().then((all) => {
      const supported = all.filter(scraperSupportsPlatform).sort();
      setPlatforms(supported);
      setSelected((prev) => prev || supported[0] || "");
    });
  }, []);

  const run = useCallback(async () => {
    if (!selected) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      const res = await scrapePlatformArt(selected, setProgress);
      setResult(res);
    } catch (caught) {
      console.error(caught);
      setError("Falha ao baixar arte (rede ou plataforma sem dados).");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [selected]);

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <div>
      <AdminPageHeader
        title="Arte / Scraper"
        description="Baixa capas e telas dos jogos automaticamente do servidor de thumbnails do libretro (grátis). Pula o que já tem arte."
      />
      <div className="space-y-6 p-8">
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-400">Plataforma</span>
            <Select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={running}
              className="min-w-72"
            >
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </label>
          <Button onClick={() => void run()} disabled={running || !selected}>
            <Download className="h-4 w-4" />
            {running ? "Baixando..." : "Baixar arte"}
          </Button>
        </div>

        {platforms.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nenhuma plataforma com scraper suportado encontrada.
          </p>
        ) : null}

        {running && progress ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-zinc-300">
                {progress.done}/{progress.total} — {progress.found} capas
              </span>
              <span className="text-zinc-500">{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2 truncate text-xs text-zinc-500">
              {progress.current}
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-sm">
            <ImageDown className="h-5 w-5 text-emerald-400" />
            <div>
              <div className="font-semibold text-emerald-300">
                Concluído: {result.boxarts} capas + {result.snaps} telas baixadas
              </div>
              <div className="text-zinc-400">
                {result.total} jogos no banco · {result.skipped} já tinham arte
              </div>
            </div>
          </div>
        ) : null}

        <p className="text-xs text-zinc-500">
          Arcade (MAME/Neo Geo) não é coberto pelo libretro (nomes diferentes). A
          arte vai para Media/&lt;plataforma&gt;/Images/Wheel (capa) e Snap (tela).
        </p>
      </div>
    </div>
  );
}
