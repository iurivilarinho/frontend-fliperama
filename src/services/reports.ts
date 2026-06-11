import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  FinancialSummary,
  PaymentRow,
  RevenueByDay,
} from "./db/analytics";

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

async function saveBytes(
  defaultName: string,
  bytes: Uint8Array,
  ext: string,
): Promise<boolean> {
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  if (!path) return false;
  await writeFile(path, bytes);
  return true;
}

export type FinancialReportData = {
  summary: FinancialSummary;
  payments: PaymentRow[];
  byDay: RevenueByDay[];
};

function summaryRows(s: FinancialSummary): [string, string][] {
  return [
    ["Receita hoje", brl(s.revenueTodayCents)],
    ["Receita semana", brl(s.revenueWeekCents)],
    ["Receita mês", brl(s.revenueMonthCents)],
    ["Receita total", brl(s.revenueTotalCents)],
    ["Ticket médio", brl(s.avgTicketCents)],
    ["Sessões", String(s.sessions)],
    ["Pagamentos", String(s.payments)],
    ["Tempo médio (min)", String(s.avgSessionMinutes)],
    ["Conversão", `${s.conversionPct}%`],
  ];
}

export async function exportFinancialExcel(
  data: FinancialReportData,
): Promise<boolean> {
  const wb = XLSX.utils.book_new();

  const resumo = XLSX.utils.aoa_to_sheet([
    ["Indicador", "Valor"],
    ...summaryRows(data.summary),
  ]);
  XLSX.utils.book_append_sheet(wb, resumo, "Resumo");

  const receita = XLSX.utils.aoa_to_sheet([
    ["Dia", "Receita (R$)"],
    ...data.byDay.map((d) => [d.day, (d.cents / 100).toFixed(2)]),
  ]);
  XLSX.utils.book_append_sheet(wb, receita, "Receita por dia");

  const pagamentos = XLSX.utils.aoa_to_sheet([
    ["#", "Valor (R$)", "Minutos", "Status", "Criado", "Pago"],
    ...data.payments.map((p) => [
      p.id,
      (p.amount_cents / 100).toFixed(2),
      p.minutes,
      p.status,
      p.created_at,
      p.paid_at ?? "",
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, pagamentos, "Pagamentos");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return saveBytes("financeiro.xlsx", new Uint8Array(out), "xlsx");
}

export async function exportFinancialPdf(
  data: FinancialReportData,
): Promise<boolean> {
  const doc = new jsPDF();
  doc.setFontSize?.(16);
  doc.text("Relatório Financeiro - Retro Nexus", 14, 18);
  doc.setFontSize?.(10);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    14,
    25,
  );

  autoTable(doc, {
    startY: 32,
    head: [["Indicador", "Valor"]],
    body: summaryRows(data.summary),
    theme: "striped",
  });

  type WithLast = { lastAutoTable?: { finalY: number } };
  const y1 = (doc as unknown as WithLast).lastAutoTable?.finalY ?? 60;

  autoTable(doc, {
    startY: y1 + 8,
    head: [["#", "Valor", "Min", "Status", "Data"]],
    body: data.payments.map((p) => [
      String(p.id),
      brl(p.amount_cents),
      String(p.minutes),
      p.status,
      new Date(p.paid_at ?? p.created_at).toLocaleString("pt-BR"),
    ]),
    theme: "grid",
  });

  const ab = doc.output("arraybuffer");
  return saveBytes("financeiro.pdf", new Uint8Array(ab), "pdf");
}
