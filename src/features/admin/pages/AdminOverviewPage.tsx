import { AdminPageHeader } from "../AdminLayout";

const MODULES = [
  { label: "Precificação", status: "Pronto", to: "/admin/precos" },
  { label: "Jogos / Upload", status: "Pronto", to: "/admin/jogos" },
  { label: "ROMs (biblioteca)", status: "Pronto", to: "/admin/rooms" },
  { label: "Financeiro", status: "Pronto", to: "/admin/financeiro" },
  { label: "Controle de uso", status: "Pronto", to: "/admin/uso" },
  { label: "Saves", status: "Pronto", to: "/admin/saves" },
  { label: "Controles", status: "Pronto", to: "/admin/controles" },
  { label: "Catálogo", status: "Pronto", to: "/admin/catalogo" },
];

export function AdminOverviewPage() {
  return (
    <div>
      <AdminPageHeader
        title="Visão geral"
        description="Painel administrativo do totem. Dados persistidos localmente (SQLite)."
      />
      <div className="grid grid-cols-1 gap-4 p-8 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <a
            key={m.to}
            href={`#${m.to}`}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-emerald-500/40"
          >
            <div className="text-sm text-zinc-400">{m.label}</div>
            <div
              className={[
                "mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold",
                m.status === "Pronto"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-zinc-700/50 text-zinc-400",
              ].join(" ")}
            >
              {m.status}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export function AdminPlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <AdminPageHeader title={title} description="Módulo em construção." />
      <div className="p-8">
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-10 text-center text-sm text-zinc-500">
          Em construção — será entregue nas próximas fases.
        </div>
      </div>
    </div>
  );
}
