import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminPageHeader } from "../AdminLayout";
import {
  getMostPlayed,
  getRecentUsage,
  getSessionsSummary,
  getUsageByPlatform,
  type MostPlayed,
  type PlatformUsage,
  type SessionsSummary,
  type UsageRow,
} from "../../../services/db/analytics";

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={["mt-2 text-2xl font-bold", tone ?? "text-zinc-100"].join(" ")}>
        {value}
      </div>
    </div>
  );
}

export function UsagePage() {
  const [sessions, setSessions] = useState<SessionsSummary | null>(null);
  const [byPlatform, setByPlatform] = useState<PlatformUsage[]>([]);
  const [mostPlayed, setMostPlayed] = useState<MostPlayed[]>([]);
  const [recent, setRecent] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p, m, r] = await Promise.all([
        getSessionsSummary(),
        getUsageByPlatform(),
        getMostPlayed(15),
        getRecentUsage(30),
      ]);
      setSessions(s);
      setByPlatform(p);
      setMostPlayed(m);
      setRecent(r);
    } catch (caught) {
      console.error(caught);
      setError("Não foi possível carregar os dados de uso.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const platformChartData = byPlatform.map((p) => ({
    plataforma: p.platform,
    lançamentos: p.launches,
  }));

  return (
    <div>
      <AdminPageHeader
        title="Controle de uso"
        description="Sessões, tempo por plataforma e jogos mais utilizados."
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
        {loading || !sessions ? (
          <p className="text-sm text-zinc-400">Carregando...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi label="Sessões ativas" value={String(sessions.active)} tone="text-emerald-300" />
              <Kpi label="Encerradas" value={String(sessions.ended)} />
              <Kpi label="Expiradas" value={String(sessions.expired)} tone="text-amber-300" />
              <Kpi label="Hoje" value={String(sessions.today)} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="mb-4 text-sm font-semibold text-zinc-300">
                  Uso por plataforma
                </div>
                {platformChartData.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sem dados ainda.</p>
                ) : (
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(120, platformChartData.length * 32)}
                  >
                    <BarChart data={platformChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis type="number" stroke="#71717a" fontSize={11} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="plataforma"
                        stroke="#71717a"
                        fontSize={10}
                        width={120}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#18181b",
                          border: "1px solid #3f3f46",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="lançamentos" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="mb-4 text-sm font-semibold text-zinc-300">
                  Jogos mais jogados
                </div>
                {mostPlayed.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sem dados ainda.</p>
                ) : (
                  <div className="space-y-1 text-sm">
                    {mostPlayed.map((g) => (
                      <div
                        key={`${g.platform_name}-${g.rom_name}`}
                        className="flex justify-between"
                      >
                        <span className="truncate text-zinc-300">
                          {g.rom_name}
                          <span className="ml-2 text-xs text-zinc-600">
                            {g.platform_name}
                          </span>
                        </span>
                        <span className="text-emerald-300">{g.play_count}x</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 text-sm font-semibold text-zinc-300">
                Histórico recente
              </div>
              {recent.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhum uso registrado ainda.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900/60 text-left text-zinc-400">
                      <tr>
                        <th className="px-4 py-2 font-medium">Jogo</th>
                        <th className="px-4 py-2 font-medium">Plataforma</th>
                        <th className="px-4 py-2 font-medium">Quando</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((u) => (
                        <tr key={u.id} className="border-t border-zinc-800">
                          <td className="px-4 py-2">{u.rom_name}</td>
                          <td className="px-4 py-2 text-zinc-400">
                            {u.platform_name}
                          </td>
                          <td className="px-4 py-2 text-zinc-500">
                            {new Date(u.started_at).toLocaleString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
