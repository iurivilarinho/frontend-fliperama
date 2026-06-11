import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2, RefreshCw } from "lucide-react";
import { AdminPageHeader } from "../AdminLayout";
import {
  CONTROL_ACTIONS,
  CONTROLLER_LABEL,
  DEFAULT_MAPPING,
  listConnectedControllers,
  readPressedButtons,
  type ConnectedController,
  type ControlAction,
  type ControlMapping,
} from "../../../services/gamepad";
import {
  loadControlMapping,
  saveControlMapping,
} from "../../../services/db/controls";

export function ControlsPage() {
  const [controllers, setControllers] = useState<ConnectedController[]>([]);
  const [pressed, setPressed] = useState<number[]>([]);
  const [mapping, setMapping] = useState<ControlMapping>(DEFAULT_MAPPING);
  const [binding, setBinding] = useState<ControlAction | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const prevPressedRef = useRef<Set<number>>(new Set());
  const bindingRef = useRef<ControlAction | null>(null);
  bindingRef.current = binding;
  const mappingRef = useRef<ControlMapping>(mapping);
  mappingRef.current = mapping;

  useEffect(() => {
    void loadControlMapping().then(setMapping);
  }, []);

  const persist = useCallback(async (next: ControlMapping) => {
    await saveControlMapping(next);
    setSavedAt(Date.now());
    window.dispatchEvent(new Event("controls-updated"));
  }, []);

  // Loop de leitura ao vivo (controles, botões pressionados, binding por borda).
  useEffect(() => {
    const id = window.setInterval(() => {
      setControllers(listConnectedControllers());
      const now = readPressedButtons();
      setPressed([...now].sort((a, b) => a - b));

      const action = bindingRef.current;
      if (action) {
        // captura o primeiro botão recém-pressionado
        for (const b of now) {
          if (!prevPressedRef.current.has(b)) {
            const next = { ...mappingRef.current, [action]: b };
            setMapping(next);
            setBinding(null);
            void persist(next);
            break;
          }
        }
      }
      prevPressedRef.current = now;
    }, 60);
    return () => window.clearInterval(id);
  }, [persist]);

  const resetDefaults = async () => {
    setMapping(DEFAULT_MAPPING);
    await persist(DEFAULT_MAPPING);
  };

  return (
    <div>
      <AdminPageHeader
        title="Controles"
        description="Configuração global do controle (vale para o totem inteiro). Detecta PlayStation, Xbox e genéricos. Os emuladores tratam o input dentro do jogo."
        actions={
          <button
            type="button"
            onClick={() => void resetDefaults()}
            className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-semibold hover:border-emerald-400"
          >
            <RefreshCw className="h-4 w-4" /> Restaurar padrão
          </button>
        }
      />

      <div className="p-8">
        {/* controles conectados */}
        <div className="mb-6">
          <div className="mb-2 text-sm font-semibold text-zinc-300">
            Controles conectados ({controllers.length})
          </div>
          {controllers.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nenhum controle detectado. Conecte e pressione um botão (a Web
              Gamepad API só enxerga o controle após a primeira interação).
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {controllers.map((c) => (
                <div
                  key={c.index}
                  className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <Gamepad2 className="h-6 w-6 text-emerald-400" />
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {CONTROLLER_LABEL[c.type]}
                    </div>
                    <div className="truncate text-xs text-zinc-500">{c.id}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* teste ao vivo */}
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-2 text-sm font-semibold text-zinc-300">
            Teste — botões pressionados agora
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
                  botão {b}
                </span>
              ))
            )}
          </div>
        </div>

        {/* mapeamento */}
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-left text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Ação</th>
                <th className="px-4 py-3 font-medium">Botão</th>
                <th className="px-4 py-3 text-right font-medium">Vincular</th>
              </tr>
            </thead>
            <tbody>
              {CONTROL_ACTIONS.map(({ action, label }) => (
                <tr key={action} className="border-t border-zinc-800">
                  <td className="px-4 py-3 font-medium">{label}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs">
                      botão {mapping[action]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setBinding((cur) => (cur === action ? null : action))
                      }
                      className={[
                        "rounded-lg px-3 py-1 text-xs font-semibold transition",
                        binding === action
                          ? "animate-pulse bg-amber-500/20 text-amber-300"
                          : "border border-zinc-600 bg-zinc-800 hover:border-emerald-400",
                      ].join(" ")}
                    >
                      {binding === action ? "Aperte um botão..." : "Vincular"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {savedAt ? (
          <p className="mt-3 text-xs text-emerald-300">
            Mapeamento salvo e aplicado ao totem.
          </p>
        ) : null}

        <p className="mt-4 text-xs text-zinc-500">
          Na tela do totem: D-pad/analógico movem a roda, e os botões fazem
          Confirmar/Voltar/Favoritar/Buscar conforme o mapeamento acima.
        </p>
      </div>
    </div>
  );
}
