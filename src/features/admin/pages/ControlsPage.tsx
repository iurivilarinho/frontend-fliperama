import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2, RefreshCw, Wrench } from "lucide-react";
import { AdminPageHeader } from "../AdminLayout";
import { GamepadVisual, type GamepadVariant } from "../GamepadVisual";
import {
  CONTROL_ACTIONS,
  CONTROL_PRESETS,
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
  loadNumPlayers,
  saveControlMapping,
  saveInGameMapping,
  saveNumPlayers,
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
  const [numPlayers, setNumPlayers] = useState(1);
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
    void loadNumPlayers().then(setNumPlayers);
  }, []);

  const applyPreset = useCallback(
    async (presetId: string) => {
      const preset = CONTROL_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      setNav(preset.nav);
      setIngame(preset.ingame);
      await saveControlMapping(preset.nav);
      await saveInGameMapping(preset.ingame);
      window.dispatchEvent(new Event("controls-updated"));
    },
    [],
  );

  const changeNumPlayers = useCallback(async (n: number) => {
    setNumPlayers(n);
    await saveNumPlayers(n);
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
      setApplyResult(await applyInGameMapping(ingame, numPlayers));
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
        {/* hero: gamepad ao vivo */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900/50 to-emerald-950/40 p-6 shadow-2xl">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[1.25fr_1fr]">
            <div className="flex justify-center">
              <GamepadVisual
                pressed={new Set(pressed)}
                variant={controllers[0]?.type ?? "generic"}
              />
            </div>
            <div className="relative">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                {controllers.length > 0 ? "Controle conectado" : "Nenhum controle"}
              </div>
              <div className="mt-1 text-3xl font-black">
                {controllers.length > 0
                  ? CONTROLLER_LABEL[controllers[0].type]
                  : "—"}
              </div>
              {controllers.length === 0 ? (
                <p className="mt-2 max-w-sm text-sm text-zinc-400">
                  Conecte um controle e aperte um botão (a API só enxerga após a
                  primeira interação). Os botões acendem no desenho ao lado.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {controllers.map((c) => (
                    <div
                      key={c.index}
                      className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-sm"
                    >
                      <Gamepad2 className="h-4 w-4 text-emerald-400" />
                      <span className="font-semibold">
                        {CONTROLLER_LABEL[c.type]}
                      </span>
                      <span className="truncate text-xs text-zinc-500">
                        {c.id}
                      </span>
                    </div>
                  ))}
                  <div className="pt-1 text-xs text-zinc-500">
                    Pressionados:{" "}
                    <span className="font-mono text-emerald-300">
                      {pressed.length ? pressed.join(" · ") : "—"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* presets */}
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-300">
            Presets
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CONTROL_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void applyPreset(p.id)}
                className="group rounded-xl border border-zinc-700 bg-zinc-900/40 p-4 text-left transition hover:border-emerald-400 hover:bg-zinc-900/70"
              >
                <div className="mb-3 flex h-24 items-center justify-center">
                  <GamepadVisual
                    pressed={new Set<number>()}
                    variant={p.id as GamepadVariant}
                    className="max-h-24 w-auto opacity-80 transition group-hover:opacity-100"
                  />
                </div>
                <div className="font-semibold">{p.label}</div>
                <div className="mt-1 text-xs text-zinc-500">{p.description}</div>
              </button>
            ))}
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
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                Jogadores
                <select
                  value={numPlayers}
                  onChange={(e) => void changeNumPlayers(Number(e.target.value))}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
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
            MAME (best-effort, com backup do default.cfg) para os{" "}
            <span className="text-zinc-300">{numPlayers} jogador(es)</span> —
            cada um num controle (P1 = controle 0, P2 = controle 1...). Os
            emuladores standalone (Project64, Nestopia, ZSNES, Fusion) usam o
            próprio menu de input e geralmente já auto-detectam o controle.
          </p>
        </div>
      </div>
    </div>
  );
}
