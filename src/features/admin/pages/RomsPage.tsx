import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { AdminPageHeader } from "../AdminLayout";
import {
  reconcileAll,
  type LibraryReport,
  type PlatformReconciliation,
} from "../../../services/romLibrary";
import { Spinner } from "../../../components/spinner/Spinner";

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={["mt-2 text-3xl font-bold", tone ?? "text-zinc-100"].join(" ")}>
        {value}
      </div>
    </div>
  );
}

export function RomsPage() {
  const [report, setReport] = useState<LibraryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlatformReconciliation | null>(null);
  const [filter, setFilter] = useState("");

  const filteredPlatforms = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = report?.platforms ?? [];
    if (!q) return list;
    return list.filter((p) => p.platform.toLowerCase().includes(q));
  }, [report, filter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await reconcileAll());
    } catch (caught) {
      console.error(caught);
      setError("Não foi possível ler o catálogo/ROMs (config do HyperSpin).");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <AdminPageHeader
        title="Gestão de ROMs"
        description="Reconciliação entre os jogos cadastrados (banco) e os arquivos de ROM no disco."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-semibold hover:border-emerald-400"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        }
      />

      <div className="p-8">
        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-12" />
          </div>
        ) : report ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <Kpi label="Jogos cadastrados" value={report.totals.games} />
              <Kpi label="ROMs disponíveis" value={report.totals.roms} />
              <Kpi
                label="Jogos com ROM"
                value={report.totals.matched}
                tone="text-emerald-300"
              />
              <Kpi
                label="Jogos sem ROM"
                value={report.totals.missing}
                tone="text-amber-300"
              />
              <Kpi
                label="ROMs órfãos"
                value={report.totals.orphans}
                tone="text-sky-300"
              />
              <Kpi
                label="Taxa de ocupação"
                value={`${report.totals.occupancyPct}%`}
                tone="text-emerald-300"
              />
            </div>

            <div className="mt-8 flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filtrar plataforma..."
                  className="w-72 rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400"
                />
              </div>
              <span className="text-xs text-zinc-500">
                {filteredPlatforms.length} de {report.platforms.length}
              </span>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/60 text-left text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Plataforma</th>
                    <th className="px-4 py-3 font-medium">Jogos</th>
                    <th className="px-4 py-3 font-medium">ROMs</th>
                    <th className="px-4 py-3 font-medium">Com ROM</th>
                    <th className="px-4 py-3 font-medium">Sem ROM</th>
                    <th className="px-4 py-3 font-medium">Órfãos</th>
                    <th className="px-4 py-3 font-medium">Ocupação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlatforms.map((p) => (
                    <tr
                      key={p.platform}
                      onClick={() => setSelected(p)}
                      className="cursor-pointer border-t border-zinc-800 hover:bg-zinc-800/40"
                    >
                      <td className="px-4 py-3 font-medium">{p.platform}</td>
                      <td className="px-4 py-3">{p.gamesCount}</td>
                      <td className="px-4 py-3">{p.romsCount}</td>
                      <td className="px-4 py-3 text-emerald-300">{p.matched}</td>
                      <td className="px-4 py-3 text-amber-300">
                        {p.missingRoms.length}
                      </td>
                      <td className="px-4 py-3 text-sky-300">
                        {p.orphanRoms.length}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-700">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${p.occupancyPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400">
                            {p.occupancyPct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selected ? (
              <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                  <div className="mb-3 text-sm font-semibold text-amber-300">
                    {selected.platform} · Jogos sem ROM (
                    {selected.missingRoms.length})
                  </div>
                  <div className="max-h-72 space-y-1 overflow-y-auto text-sm text-zinc-300">
                    {selected.missingRoms.length === 0 ? (
                      <p className="text-zinc-500">Nenhum.</p>
                    ) : (
                      selected.missingRoms.map((n) => <div key={n}>{n}</div>)
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                  <div className="mb-3 text-sm font-semibold text-sky-300">
                    {selected.platform} · ROMs órfãos ({selected.orphanRoms.length})
                  </div>
                  <div className="max-h-72 space-y-1 overflow-y-auto text-sm text-zinc-300">
                    {selected.orphanRoms.length === 0 ? (
                      <p className="text-zinc-500">Nenhum.</p>
                    ) : (
                      selected.orphanRoms.map((n) => <div key={n}>{n}</div>)
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-xs text-zinc-500">
                Clique numa plataforma para ver os jogos sem ROM e os ROMs órfãos.
              </p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
