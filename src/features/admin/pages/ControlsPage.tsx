import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2, RefreshCw, Wrench } from "lucide-react";
import { AdminPageHeader } from "../AdminLayout";
import {
  CONTROL_ACTIONS,
  CONTROLLER_LABEL,
  DEFAULT_INGAME_MAPPING,
  DEFAULT_MAPPING,
  INGAME_BUTTONS,
  listConnectedControllers,
  readPressedButtons,
  type ConnectedController,
  type ControlMapping,
  type InGameMapping,
} from "../../../services/gamepad";
import {
  loadControlMapping,
  loadInGameMapping,
  saveControlMapping,
  saveInGameMapping,
} from "../../../services/db/controls";
import {
  applyInGameMapping,
  type ApplyResult,
} from "../../../services/emulatorInput";

export function ControlsPage() {
  const [controllers, setControllers] = useState<ConnectedController[]>([]);
  const [pressed, setPressed] = useState<number[]>([]);
  const [nav, setNav] = useState<ControlMapping>(DEFAULT_MAPPING);
  const [ingame, setIngame] = useState<InGameMapping>(DEFAULT_INGAME_MAPPING);
  const [binding, setBinding] = useState<string | null>(null); // "nav:up" | "ingame:south"
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);

  const prevPressedRef = useRef<Set<number>>(new Set());
  const bindingRef = useRef<string | null>(null);
  bindingRef.current = binding;
  const navRef = useRef(nav);
  navRef.current = nav;
  const ingameRef = useRef(ingame);
  ingameRef.current = ingame;

  useEffect(() => {
    void loadControlMapping().then(setNav);
    void loadInGameMapping().then(setIngame);
  }, []);

  const persistNav = useCallback(async (next: ControlMapping) => {
    await saveControlMapping(next);
    window.dispatchEvent(new Event("controls-updated"));
  }, []);
  const persistIngame = useCallback(async (next: InGameMapping) => {
    await saveInGameMapping(next);
  }, []);

  // Loop ao vivo: controles, botões e captura de binding (por borda).
  useEffect(() => {
    const id = window.setInterval(() => {
      setControllers(listConnectedControllers());
      const now = readPressedButtons();
      setPressed([...now].sort((a, b) => a - b));

      const target = bindingRef.current;
      if (target) {
        for (const b of now) {
          if (prevPressedRef.current.has(b)) continue;
          const [kind, key] = target.split(":");
          if (kind === "nav") {
            const next = { ...navRef.current, [key]: b } as ControlMapping;
            setNav(next);
            void persistNav(next);
          } else {
            const next = { ...ingameRef.current, [key]: b } as InGameMapping;
            setIngame(next);
            void persistIngame(next);
          }
          setBinding(null);
          break;
        }
      }
      prevPressedRef.current = now;
    }, 60);
    return () => window.clearInterval(id);
  }, [persistNav, persistIngame]);

  const resetNav = async () => {
    setNav(DEFAULT_MAPPING);
    await persistNav(DEFAULT_MAPPING);
  };
  const resetIngame = async () => {
    setIngame(DEFAULT_INGAME_MAPPING);
    await persistIngame(DEFAULT_INGAME_MAPPING);
  };

  const handleApply = async () => {
    setApplying(true);
    setApplyResult(null);
    try {
      setApplyResult(await applyInGameMapping(ingame));
    } catch (e) {
      console.error(e);
      setApplyResult({ applied: [], skipped: ["Erro ao gerar configs"] });
    } finally {
      setApplying(false);
    }
  };

  const bindButton = (id: string) => (
    <button
      type="button"
      onClick={() => setBinding((c) => (c === id ? null : id))}
      className={[
        "rounded-lg px-3 py-1 text-xs font-semibold transition",
        binding === id
          ? "animate-pulse bg-amber-500/20 text-amber-300"
          : "border border-zinc-600 bg-zinc-800 hover:border-emerald-400",
      ].join(" ")}
    >
      {binding === id ? "Aperte um botão..." : "Vincular"}
    </button>
  );

  return (
    <div>
      <AdminPageHeader
        title="Controles"
        description="Config global do controle (PS/Xbox/genérico). Navegação do totem + mapeamento dentro do jogo (gera os configs dos emuladores)."
      />

      <div className="space-y-8 p-8">
        {/* controles conectados + teste */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-2 text-sm font-semibold text-zinc-300">
              Conectados ({controllers.length})
            </div>
            {controllers.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Nenhum controle. Conecte e aperte um botão (a API só enxerga após
                a 1ª interação).
              </p>
            ) : (
              controllers.map((c) => (
                <div key={c.index} className="flex items-center gap-2 py-1">
                  <Gamepad2 className="h-5 w-5 text-emerald-400" />
                  <span className="font-semibold">
                    {CONTROLLER_LABEL[c.type]}
                  </span>
                  <span className="truncate text-xs text-zinc-500">{c.id}</span>
                </div>
              ))
            )}
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-2 text-sm font-semibold text-zinc-300">
              Botões pressionados
            </div>
            <div className="flex min-h-7 flex-wrap gap-2">
              {pressed.length === 0 ? (
                <span className="text-sm text-zinc-500">(nenhum)</span>
              ) : (
                pressed.map((b) => (
                  <span
                    key={b}
                    className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300"
                  >
                    {b}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* navegação do totem */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-300">
              Navegação do totem
            </h2>
            <button
              type="button"
              onClick={() => void resetNav()}
              className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs hover:border-emerald-400"
            >
              <RefreshCw className="h-3 w-3" /> Padrão
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <tbody>
                {CONTROL_ACTIONS.map(({ action, label }) => (
                  <tr key={action} className="border-t border-zinc-800 first:border-t-0">
                    <td className="px-4 py-2 font-medium">{label}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs">
                        botão {nav[action]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {bindButton(`nav:${action}`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* dentro do jogo */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-300">
              Dentro do jogo (emuladores)
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void resetIngame()}
                className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs hover:border-emerald-400"
              >
                <RefreshCw className="h-3 w-3" /> Padrão
              </button>
              <button
                type="button"
                disabled={applying}
                onClick={() => void handleApply()}
                className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                <Wrench className="h-3 w-3" />
                {applying ? "Aplicando..." : "Aplicar aos emuladores"}
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <tbody>
                {INGAME_BUTTONS.map(({ key, label }) => (
                  <tr key={key} className="border-t border-zinc-800 first:border-t-0">
                    <td className="px-4 py-2 font-medium">{label}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs">
                        botão {ingame[key]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {bindButton(`ingame:${key}`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {applyResult ? (
            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
              {applyResult.applied.map((a) => (
                <div key={a} className="text-emerald-300">
                  ✓ {a}
                </div>
              ))}
              {applyResult.skipped.map((s) => (
                <div key={s} className="text-zinc-500">
                  — {s}
                </div>
              ))}
            </div>
          ) : null}

          <p className="mt-3 text-xs text-zinc-500">
            "Aplicar" gera o config do RetroArch (10 plataformas, confiável) e do
            MAME (best-effort, com backup do default.cfg). Os emuladores
            standalone (Project64, Nestopia, ZSNES, Fusion) usam o próprio menu de
            input e geralmente já auto-detectam o controle.
          </p>
        </div>
      </div>
    </div>
  );
}
