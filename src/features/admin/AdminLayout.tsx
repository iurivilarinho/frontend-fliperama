import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Banknote,
  DoorOpen,
  Gamepad2,
  ImageDown,
  LayoutDashboard,
  Library,
  LogOut,
  Save,
  Settings,
  Tags,
  Timer,
  Upload,
} from "lucide-react";
import { useAdminAuth } from "./AdminAuthContext";

const NAV = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard, end: true },
  { to: "/admin/precos", label: "Precificação", icon: Tags },
  { to: "/admin/jogos", label: "Jogos / Upload", icon: Upload },
  { to: "/admin/rooms", label: "ROMs", icon: DoorOpen },
  { to: "/admin/financeiro", label: "Financeiro", icon: Banknote },
  { to: "/admin/uso", label: "Controle de uso", icon: Timer },
  { to: "/admin/saves", label: "Saves", icon: Save },
  { to: "/admin/controles", label: "Controles", icon: Gamepad2 },
  { to: "/admin/catalogo", label: "Catálogo", icon: Library },
  { to: "/admin/arte", label: "Arte / Scraper", icon: ImageDown },
  { to: "/admin/config", label: "Configurações", icon: Settings },
];

export function AdminLayout() {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
        <div className="px-5 py-5">
          <div className="text-lg font-black tracking-tight">
            LIS · Fliperama
          </div>
          <div className="text-xs text-zinc-500">Painel administrativo</div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
                ].join(" ")
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-zinc-800 p-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <Gamepad2 className="h-4 w-4" />
            Voltar ao totem
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/admin");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800 bg-zinc-900/40 px-8 py-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
