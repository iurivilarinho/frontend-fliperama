import { useCallback, useEffect, useState } from "react";
import { DatabaseBackup, RefreshCw } from "lucide-react";
import { AdminPageHeader } from "../AdminLayout";
import {
  backupSaves,
  countBackups,
  listRecentSaves,
  listSaveLocations,
  type SaveLocation,
  type SaveRow,
} from "../../../services/saves";

export function SavesPage() {
  const [locations, setLocations] = useState<SaveLocation[]>([]);
  const [recent, setRecent] = useState<SaveRow[]>([]);
  const [backups, setBackups] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [locs, rows, count] = await Promise.all([
        listSaveLocations(),
        listRecentSaves(50),
        countBackups(),
      ]);
      setLocations(locs);
      setRecent(rows);
      setBackups(count);
    } catch (caught) {
      console.error(caught);
      setError("Não foi possível ler os saves (config do HyperSpin).");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleBackup = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await backupSaves();
      setMessage(`Backup concluído: ${res.fileCount} arquivo(s) em ${res.backupDir}`);
      await load();
    } catch (caught) {
      console.error(caught);
      setError("Falha ao fazer backup dos saves.");
    } finally {
      setBusy(false);
    }
  };

  const totalFiles = locations.reduce((acc, l) => acc + l.fileCount, 0);

  return (
    <div>
      <AdminPageHeader
        title="Saves / Progresso"
        description="Backup e acompanhamento dos saves dos emuladores. Os emuladores carregam os saves automaticamente; o backup é cópia de segurança."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-semibold hover:border-emerald-400"
            >
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleBackup()}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              <DatabaseBackup className="h-4 w-4" />
              {busy ? "Salvando..." : "Backup agora"}
            </button>
          </div>
        }
      />

      <div className="p-8">
        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}
        {message ? (
          <p className="mb-4 text-sm text-emerald-300">{message}</p>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-400">Carregando...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Arquivos de save no disco
                </div>
                <div className="mt-2 text-3xl font-bold">{totalFiles}</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Backups realizados
                </div>
                <div className="mt-2 text-3xl font-bold">{backups}</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Locais monitorados
                </div>
                <div className="mt-2 text-3xl font-bold">
                  {locations.filter((l) => l.exists).length}/{locations.length}
                </div>
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/60 text-left text-zinc-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Local</th>
                    <th className="px-4 py-2 font-medium">Arquivos</th>
                    <th className="px-4 py-2 font-medium">Pasta</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((l) => (
                    <tr key={l.dir} className="border-t border-zinc-800">
                      <td className="px-4 py-2">{l.label}</td>
                      <td className="px-4 py-2">
                        {l.exists ? (
                          l.fileCount
                        ) : (
                          <span className="text-zinc-600">não criada</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-500">{l.dir}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8">
              <div className="mb-2 text-sm font-semibold text-zinc-300">
                Saves no último(s) backup(s)
              </div>
              {recent.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhum backup ainda.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-sm">
                    <tbody>
                      {recent.map((s) => (
                        <tr key={s.id} className="border-t border-zinc-800">
                          <td className="px-4 py-2 text-zinc-400">
                            {s.platform_name}
                          </td>
                          <td className="px-4 py-2">{s.rom_name}</td>
                          <td className="px-4 py-2 text-zinc-500">
                            {new Date(s.updated_at).toLocaleString("pt-BR")}
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
