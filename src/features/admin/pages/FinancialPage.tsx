import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
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
import { Spinner } from "../../../components/spinner/Spinner";
import {
  getFinancialSummary,
  getPeakHours,
  getRecentPayments,
  getRevenueByDay,
  type FinancialSummary,
  type PaymentRow,
  type PeakHour,
  type RevenueByDay,
} from "../../../services/db/analytics";
import {
  exportFinancialExcel,
  exportFinancialPdf,
} from "../../../services/reports";

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
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [periodDays, setPeriodDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, d, p, h] = await Promise.all([
        getFinancialSummary(),
        getRevenueByDay(periodDays),
        getRecentPayments(100),
        getPeakHours(),
      ]);
      setSummary(s);
      setByDay(d);
      setPayments(p);
      setPeakHours(h);
    } catch (caught) {
      console.error(caught);
      setError("Não foi possível carregar os dados financeiros.");
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = async (kind: "excel" | "pdf") => {
    if (!summary) return;
    setExporting(true);
    try {
      const data = { summary, payments, byDay };
      if (kind === "excel") await exportFinancialExcel(data);
      else await exportFinancialPdf(data);
    } catch (caught) {
      console.error(caught);
      setError("Falha ao exportar o relatório.");
    } finally {
      setExporting(false);
    }
  };

  const revenueChartData = byDay.map((d) => ({
    dia: d.day.slice(5),
    valor: Math.round(d.cents) / 100,
  }));
  const peakChartData = peakHours.map((h) => ({
    hora: `${h.hour}h`,
    sessões: h.count,
  }));

  return (
    <div>
      <AdminPageHeader
        title="Financeiro"
        description="Receita, pagamentos e desempenho. Dados locais do totem (SQLite)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none"
            >
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
            </select>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExport("excel")}
              className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm font-semibold hover:border-emerald-400 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExport("pdf")}
              className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm font-semibold hover:border-emerald-400 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" /> PDF
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm font-semibold hover:border-emerald-400"
            >
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
          </div>
        }
      />

      <div className="p-8">
        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}
        {loading || !summary ? (
          <div className="flex justify-center py-10"><Spinner className="size-10" /></div>
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

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="mb-4 text-sm font-semibold text-zinc-300">
                  Evolução da receita (R$)
                </div>
                {revenueChartData.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sem dados ainda.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="dia" stroke="#71717a" fontSize={11} />
                      <YAxis stroke="#71717a" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          background: "#18181b",
                          border: "1px solid #3f3f46",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="valor" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="mb-4 text-sm font-semibold text-zinc-300">
                  Horários de pico (sessões por hora)
                </div>
                {peakChartData.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sem dados ainda.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={peakChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="hora" stroke="#71717a" fontSize={11} />
                      <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "#18181b",
                          border: "1px solid #3f3f46",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="sessões" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
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
