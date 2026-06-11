import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Upload, Check, X, Save } from "lucide-react";
import { AdminPageHeader } from "../AdminLayout";
import { Button, Input, Select } from "../../../components/ui";
import {
  listManageablePlatforms,
  type ManageablePlatform,
} from "../../../services/platforms";
import {
  uploadGameFiles,
  uploadGameFolder,
  type UploadResult,
} from "../../../services/gameUpload";
import {
  listUploadedGames,
  setPlatformExtensions,
  type UploadedGameRow,
} from "../../../services/db/platformConfig";

export function GamesUploadPage() {
  const [platforms, setPlatforms] = useState<ManageablePlatform[]>([]);
  const [selectedName, setSelectedName] = useState<string>("");
  const [extText, setExtText] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [uploaded, setUploaded] = useState<UploadedGameRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selected = platforms.find((p) => p.name === selectedName) ?? null;
  const selectedRef = useRef<ManageablePlatform | null>(null);
  selectedRef.current = selected;

  const loadPlatforms = useCallback(async () => {
    try {
      const list = await listManageablePlatforms();
      setPlatforms(list);
      setSelectedName((prev) => prev || list[0]?.name || "");
    } catch (caught) {
      console.error(caught);
      setError("Não foi possível carregar as plataformas (config do HyperSpin).");
    }
  }, []);

  useEffect(() => {
    void loadPlatforms();
  }, [loadPlatforms]);

  useEffect(() => {
    if (selected) setExtText(selected.extensions.join(", "));
  }, [selected]);

  const refreshUploaded = useCallback(async (platformName: string) => {
    try {
      setUploaded(await listUploadedGames(platformName));
    } catch {
      setUploaded([]);
    }
  }, []);

  useEffect(() => {
    if (selectedName) void refreshUploaded(selectedName);
  }, [selectedName, refreshUploaded]);

  const handlePaths = useCallback(
    async (paths: string[]) => {
      const platform = selectedRef.current;
      if (!platform || paths.length === 0) return;

      setUploading(true);
      setError(null);
      try {
        const res = await uploadGameFiles(platform, paths);
        setResults(res);
        await refreshUploaded(platform.name);
      } catch (caught) {
        console.error(caught);
        setError("Falha ao processar o upload.");
      } finally {
        setUploading(false);
      }
    },
    [refreshUploaded],
  );

  // Drag-and-drop nativo do Tauri (caminhos reais de arquivo). Só no app — num
  // navegador remoto (admin via rede) não há runtime Tauri e getCurrentWebview()
  // lança erro síncrono que quebraria a página.
  useEffect(() => {
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          setDragging(true);
        } else if (payload.type === "leave") {
          setDragging(false);
        } else if (payload.type === "drop") {
          setDragging(false);
          void handlePaths(payload.paths);
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        // ambiente sem runtime Tauri
      });
    return () => {
      if (unlisten) unlisten();
    };
  }, [handlePaths]);

  const handlePickFiles = useCallback(async () => {
    const platform = selectedRef.current;
    if (!platform) return;
    const picked = await open({
      multiple: true,
      directory: false,
      filters: [
        {
          name: platform.name,
          extensions: platform.extensions.map((e) => e.replace(/^\./, "")),
        },
      ],
    });
    if (!picked) return;
    const paths = Array.isArray(picked) ? picked : [picked];
    await handlePaths(paths);
  }, [handlePaths]);

  const handlePickFolder = useCallback(async () => {
    const platform = selectedRef.current;
    if (!platform) return;
    const picked = await open({ multiple: false, directory: true });
    if (!picked || Array.isArray(picked)) return;

    setUploading(true);
    setError(null);
    try {
      const res = await uploadGameFolder(platform, picked);
      setResults([res]);
      await refreshUploaded(platform.name);
    } catch (caught) {
      console.error(caught);
      setError("Falha ao adicionar a pasta do jogo.");
    } finally {
      setUploading(false);
    }
  }, [refreshUploaded]);

  const handleSaveExtensions = useCallback(async () => {
    if (!selected) return;
    const exts = extText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await setPlatformExtensions(selected.name, exts);
    await loadPlatforms();
  }, [selected, extText, loadPlatforms]);

  return (
    <div>
      <AdminPageHeader
        title="Jogos / Upload"
        description="Envie ROMs por plataforma (clique ou arraste). Os arquivos vão para a pasta correta e são registrados automaticamente."
      />

      <div className="p-8">
        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

        <div className="mb-6 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-400">Plataforma</span>
            <Select
              value={selectedName}
              onChange={(e) => {
                setSelectedName(e.target.value);
                setResults([]);
              }}
              className="min-w-64"
            >
              {platforms.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex-1 text-sm">
            <span className="mb-1 block text-zinc-400">
              Extensões permitidas (separadas por vírgula)
            </span>
            <div className="flex gap-2">
              <Input
                value={extText}
                onChange={(e) => setExtText(e.target.value)}
                placeholder=".zip, .7z"
                className="min-w-0 flex-1"
              />
              <Button
                variant="secondary"
                onClick={() => void handleSaveExtensions()}
              >
                <Save className="h-4 w-4" /> Salvar
              </Button>
            </div>
          </label>
        </div>

        {/* drop zone */}
        <button
          type="button"
          onClick={() => void handlePickFiles()}
          className={[
            "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-16 transition",
            dragging
              ? "border-emerald-400 bg-emerald-500/10"
              : "border-zinc-700 bg-zinc-900/40 hover:border-zinc-500",
          ].join(" ")}
        >
          <Upload className="h-10 w-10 text-zinc-400" />
          <div className="text-sm font-semibold">
            {uploading
              ? "Enviando..."
              : "Clique para selecionar ou arraste os arquivos aqui"}
          </div>
          {selected ? (
            <div className="text-xs text-zinc-500">
              Destino: {selected.romsDir}
            </div>
          ) : null}
        </button>

        {selected?.gameImport === "folder" ? (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-2 text-sm font-semibold text-zinc-300">
              Jogo em pasta (ex.: PS3)
            </div>
            <p className="mb-3 text-xs text-zinc-500">
              Jogos de PS3 são pastas (com PS3_GAME/USRDIR/EBOOT.BIN). Selecione a
              pasta do jogo — o EBOOT.BIN é localizado e registrado para abrir
              pelo RPCS3 (a pasta é referenciada onde está, sem cópia). Pacotes
              .pkg devem ser instalados pelo próprio RPCS3.
            </p>
            <Button variant="secondary" onClick={() => void handlePickFolder()}>
              <Upload className="h-4 w-4" /> Selecionar pasta de jogo
            </Button>
          </div>
        ) : null}

        {results.length > 0 ? (
          <div className="mt-6 space-y-1">
            <div className="text-sm font-semibold text-zinc-300">
              Resultado do envio
            </div>
            {results.map((r) => (
              <div
                key={r.file}
                className="flex items-center gap-2 text-sm"
              >
                {r.ok ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <X className="h-4 w-4 text-red-400" />
                )}
                <span className="text-zinc-300">{r.file}</span>
                {r.reason ? (
                  <span className="text-xs text-zinc-500">— {r.reason}</span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {/* enviados */}
        <div className="mt-8">
          <div className="mb-2 text-sm font-semibold text-zinc-300">
            Jogos enviados via painel ({uploaded.length})
          </div>
          {uploaded.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum jogo enviado ainda.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/60 text-left text-zinc-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Jogo</th>
                    <th className="px-4 py-2 font-medium">Arquivo</th>
                    <th className="px-4 py-2 font-medium">Enviado em</th>
                  </tr>
                </thead>
                <tbody>
                  {uploaded.map((g) => (
                    <tr key={g.id} className="border-t border-zinc-800">
                      <td className="px-4 py-2">{g.title ?? g.rom_name}</td>
                      <td className="px-4 py-2 text-zinc-400">
                        {g.file_path.split(/[\\/]/).pop()}
                      </td>
                      <td className="px-4 py-2 text-zinc-500">
                        {new Date(g.created_at).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
