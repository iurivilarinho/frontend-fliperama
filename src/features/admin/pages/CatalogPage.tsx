import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminPageHeader } from "../AdminLayout";
import { Spinner } from "../../../components/spinner/Spinner";
import {
  listManageablePlatforms,
  type ManageablePlatform,
} from "../../../services/platforms";
import { setPlatformEnabled } from "../../../services/db/platformConfig";

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

const PROFILE_LABEL: Record<string, string> = {
  mame: "MAME",
  generic: "Standalone",
  retroarch: "RetroArch",
};

export function CatalogPage() {
  const [platforms, setPlatforms] = useState<ManageablePlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlatforms(await listManageablePlatforms());
    } catch (caught) {
      console.error(caught);
      setError("Não foi possível carregar o catálogo (config do HyperSpin).");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleEnabled = async (p: ManageablePlatform) => {
    await setPlatformEnabled(p.name, !p.enabled);
    await load();
  };

  return (
    <div>
      <AdminPageHeader
        title="Catálogo de plataformas"
        description="Configuração de cada plataforma: emulador, perfil de launch, banco e pasta de ROMs. Desligue uma plataforma para escondê-la do totem."
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
          <div className="flex justify-center py-10"><Spinner className="size-10" /></div>
        ) : (
          <>
            <div className="mb-4 text-sm text-zinc-400">
              {platforms.length} plataformas no catálogo ·{" "}
              {platforms.filter((p) => p.enabled).length} habilitadas
            </div>
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/60 text-left text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Plataforma</th>
                    <th className="px-4 py-3 font-medium">Perfil</th>
                    <th className="px-4 py-3 font-medium">Emulador</th>
                    <th className="px-4 py-3 font-medium">Core</th>
                    <th className="px-4 py-3 font-medium">Banco</th>
                    <th className="px-4 py-3 font-medium">Extensões</th>
                    <th className="px-4 py-3 font-medium">Habilitada</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((p) => (
                    <tr key={p.name} className="border-t border-zinc-800">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs">
                          {PROFILE_LABEL[p.launchProfile] ?? p.launchProfile}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {fileName(p.emulatorPath)}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {p.corePath ? fileName(p.corePath) : "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {p.databaseFolder}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {p.extensions.join(" ")}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void toggleEnabled(p)}
                          className={[
                            "rounded-full px-3 py-1 text-xs font-semibold transition",
                            p.enabled
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-zinc-700/50 text-zinc-400",
                          ].join(" ")}
                        >
                          {p.enabled ? "Ligada" : "Desligada"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              ROMs ficam em: a pasta de cada plataforma. Use a aba "Jogos /
              Upload" para enviar jogos e "Gestão de ROMs" para reconciliar.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
