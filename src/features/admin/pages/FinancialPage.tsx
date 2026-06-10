import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminPageHeader } from "../AdminLayout";
import {
  getFinancialSummary,
  getRecentPayments,
  getRevenueByDay,
  type FinancialSummary,
  type PaymentRow,
  type RevenueByDay,
} from "../../../services/db/analytics";

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={["mt-2 text-2xl font-bold", tone ?? "text-zinc-100"].join(" ")}>
        {value}
      </div>
    </div>
  );
}

export function FinancialPage() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [byDay, setByDay] = useState<RevenueByDay[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, d, p] = await Promise.all([
        getFinancialSummary(),
        getRevenueByDay(14),
        getRecentPayments(20),
      ]);
      setSummary(s);
      setByDay(d);
      setPayments(p);
    } catch (caught) {
      console.error(caught);
      setError("Não foi possível carregar os dados financeiros.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDay = Math.max(1, ...byDay.map((d) => d.cents));

  return (
    <div>
      <AdminPageHeader
        title="Financeiro"
        description="Receita, pagamentos e desempenho. Dados locais do totem (SQLite)."
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
        {loading || !summary ? (
          <p className="text-sm text-zinc-400">Carregando...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi label="Receita hoje" value={brl(summary.revenueTodayCents)} tone="text-emerald-300" />
              <Kpi label="Semana" value={brl(summary.revenueWeekCents)} />
              <Kpi label="Mês" value={brl(summary.revenueMonthCents)} />
              <Kpi label="Total" value={brl(summary.revenueTotalCents)} tone="text-emerald-300" />
              <Kpi label="Ticket médio" value={brl(summary.avgTicketCents)} />
              <Kpi label="Sessões" value={String(summary.sessions)} />
              <Kpi label="Pagamentos" value={String(summary.payments)} />
              <Kpi label="Tempo médio" value={`${summary.avgSessionMinutes} min`} />
            </div>

            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                Taxa de conversão (pagamentos / sessões)
              </div>
              <div className="text-2xl font-bold text-emerald-300">
                {summary.conversionPct}%
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="mb-4 text-sm font-semibold text-zinc-300">
                Receita por dia (últimos {byDay.length})
              </div>
              {byDay.length === 0 ? (
                <p className="text-sm text-zinc-500">Sem dados ainda.</p>
              ) : (
                <div className="flex items-end gap-2" style={{ height: 140 }}>
                  {byDay.map((d) => (
                    <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-emerald-500/70"
                        style={{ height: `${(d.cents / maxDay) * 110}px` }}
                        title={brl(d.cents)}
                      />
                      <div className="text-[10px] text-zinc-500">
                        {d.day.slice(5)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="mb-2 text-sm font-semibold text-zinc-300">
                Pagamentos recentes
              </div>
              {payments.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhum pagamento ainda.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900/60 text-left text-zinc-400">
                      <tr>
                        <th className="px-4 py-2 font-medium">#</th>
                        <th className="px-4 py-2 font-medium">Valor</th>
                        <th className="px-4 py-2 font-medium">Minutos</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="border-t border-zinc-800">
                          <td className="px-4 py-2 text-zinc-500">{p.id}</td>
                          <td className="px-4 py-2">{brl(p.amount_cents)}</td>
                          <td className="px-4 py-2">{p.minutes}</td>
                          <td className="px-4 py-2">
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-zinc-500">
                            {new Date(p.paid_at ?? p.created_at).toLocaleString("pt-BR")}
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
