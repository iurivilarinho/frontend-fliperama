import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Save, HelpCircle } from "lucide-react";
import { AdminPageHeader } from "../AdminLayout";
import {
  getShowWithoutRoms,
  setAdminPassword,
  setShowWithoutRoms,
} from "../../../services/db/settings";
import {
  getAllRuntimeConfig,
  migrateIniToDbIfNeeded,
  setRuntimeConfigValue,
  type RuntimeConfigKey,
} from "../../../services/runtimeConfig";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "relative h-7 w-12 rounded-full transition",
        checked ? "bg-emerald-500" : "bg-zinc-700",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-1 h-5 w-5 rounded-full bg-white transition-all",
          checked ? "left-6" : "left-1",
        ].join(" ")}
      />
    </button>
  );
}

/** Ícone "?" que mostra/esconde a descrição do campo ao clicar. */
function HelpHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label="Ajuda"
        onClick={() => setOpen((o) => !o)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-zinc-400 hover:text-emerald-300"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open ? (
        <span className="absolute left-6 top-[-4px] z-20 w-72 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs font-normal leading-relaxed text-zinc-300 shadow-xl">
          {text}
        </span>
      ) : null}
    </span>
  );
}

type FieldDef = {
  key: RuntimeConfigKey;
  label: string;
  help: string;
  kind: "folder" | "file" | "text" | "secret";
};

const FIELDS: FieldDef[] = [
  {
    key: "hyperspinBasePath",
    label: "Pasta raiz dos dados",
    help: "Pasta principal que contém Emulators, Media e Databases (ex.: D:\\HD\\fliperama-data). É a base de onde tudo é resolvido.",
    kind: "folder",
  },
  {
    key: "databasePath",
    label: "Pasta de bancos (Databases)",
    help: "Onde ficam os XMLs de cada plataforma (lista de jogos). Normalmente <raiz>\\Databases.",
    kind: "folder",
  },
  {
    key: "mediaBasePath",
    label: "Pasta de mídia (Media)",
    help: "Onde ficam as artes (Wheel/Snap), vídeos e temas das plataformas. Normalmente <raiz>\\Media.",
    kind: "folder",
  },
  {
    key: "themesBasePath",
    label: "Pasta de temas",
    help: "Base dos temas de menu do totem. Em geral é a mesma pasta de Media.",
    kind: "folder",
  },
  {
    key: "emulatorPath",
    label: "Emulador MAME (mame.exe)",
    help: "Caminho do executável do MAME, usado para os jogos de arcade. Os demais emuladores (RetroArch, RPCS3, PCSX2) são resolvidos automaticamente dentro de Emulators.",
    kind: "file",
  },
  {
    key: "romsDir",
    label: "Pasta de ROMs do MAME",
    help: "Pasta com as ROMs de arcade do MAME (arquivos .zip/.7z por nome curto).",
    kind: "folder",
  },
  {
    key: "acceptedRomExtensions",
    label: "Extensões de ROM padrão",
    help: "Extensões aceitas por padrão no MAME, separadas por vírgula (ex.: .zip, .7z). Cada plataforma do catálogo tem as suas próprias.",
    kind: "text",
  },
  {
    key: "mercadoPagoToken",
    label: "Chave / Access Token do Mercado Pago",
    help: "Token de acesso (API key) do Mercado Pago/Mercado Livre usado para gerar as cobranças PIX. Guarde com cuidado — não compartilhe.",
    kind: "secret",
  },
];

export function ConfigPage() {
  const [showWithoutRoms, setShowState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pwd, setPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  const [cfg, setCfg] = useState<Record<RuntimeConfigKey, string>>(
    {} as Record<RuntimeConfigKey, string>,
  );
  const [cfgMsg, setCfgMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Migra do .ini legado na primeira vez, para os campos já virem preenchidos.
      await migrateIniToDbIfNeeded();
      setShowState(await getShowWithoutRoms());
      setCfg(await getAllRuntimeConfig());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleShow = async (v: boolean) => {
    setShowState(v);
    await setShowWithoutRoms(v);
  };

  const changePassword = async () => {
    if (pwd.trim().length < 3) {
      setPwdMsg("A senha precisa de ao menos 3 caracteres.");
      return;
    }
    await setAdminPassword(pwd.trim());
    setPwd("");
    setPwdMsg("Senha alterada.");
    window.setTimeout(() => setPwdMsg(null), 2500);
  };

  const setField = (key: RuntimeConfigKey, value: string) =>
    setCfg((prev) => ({ ...prev, [key]: value }));

  const pickPath = async (field: FieldDef) => {
    const current = cfg[field.key]?.trim() || undefined;
    const picked = await open(
      field.kind === "file"
        ? {
            multiple: false,
            directory: false,
            defaultPath: current,
            filters: [{ name: "Executável", extensions: ["exe"] }],
          }
        : { multiple: false, directory: true, defaultPath: current },
    );
    if (typeof picked === "string") setField(field.key, picked);
  };

  const saveConfig = async () => {
    setSaving(true);
    setCfgMsg(null);
    try {
      for (const field of FIELDS) {
        await setRuntimeConfigValue(field.key, cfg[field.key] ?? "");
      }
      setCfgMsg("Configurações salvas. Reabra o totem para aplicar.");
      window.setTimeout(() => setCfgMsg(null), 4000);
    } catch (error) {
      console.error(error);
      setCfgMsg("Falha ao salvar as configurações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Configurações"
        description="Caminhos, integração e ajustes gerais do totem."
      />
      <div className="space-y-6 p-8">
        {/* Caminhos e integração */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-1 font-semibold">Caminhos e integração</div>
          <div className="mb-4 text-sm text-zinc-400">
            Onde ficam os dados do totem e a chave de pagamento. Clique em
            <span className="text-zinc-300"> Selecionar </span> para escolher a
            pasta/arquivo pelo Windows. Toque no
            <HelpCircle className="mx-1 inline h-4 w-4 align-text-bottom" />
            de cada campo para ver a explicação.
          </div>

          {loading ? (
            <span className="text-sm text-zinc-500">Carregando...</span>
          ) : (
            <div className="space-y-4">
              {FIELDS.map((field) => (
                <label key={field.key} className="block text-sm">
                  <span className="mb-1 flex items-center text-zinc-400">
                    {field.label}
                    <HelpHint text={field.help} />
                  </span>
                  <div className="flex gap-2">
                    <input
                      type={field.kind === "secret" ? "password" : "text"}
                      value={cfg[field.key] ?? ""}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={
                        field.kind === "secret"
                          ? "APP_USR-..."
                          : field.kind === "text"
                            ? ".zip, .7z"
                            : "Selecione um caminho"
                      }
                      className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none focus:border-emerald-400"
                    />
                    {field.kind === "folder" || field.kind === "file" ? (
                      <button
                        type="button"
                        onClick={() => void pickPath(field)}
                        className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 font-semibold hover:border-emerald-400"
                      >
                        <FolderOpen className="h-4 w-4" /> Selecionar
                      </button>
                    ) : null}
                  </div>
                </label>
              ))}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void saveConfig()}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar configurações"}
                </button>
                {cfgMsg ? (
                  <span className="text-sm text-emerald-300">{cfgMsg}</span>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Mostrar jogos sem ROM */}
        <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div>
            <div className="font-semibold">Mostrar jogos sem ROM</div>
            <div className="mt-1 max-w-xl text-sm text-zinc-400">
              Ligado: a interface lista todas as plataformas e jogos, mesmo sem o
              arquivo de ROM no disco (aparecem esmaecidos e não abrem). Desligado
              (padrão): só mostra jogos com ROM.
            </div>
          </div>
          {loading ? (
            <span className="text-sm text-zinc-500">...</span>
          ) : (
            <Toggle checked={showWithoutRoms} onChange={(v) => void toggleShow(v)} />
          )}
        </div>

        {/* Senha do painel */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="font-semibold">Senha do painel</div>
          <div className="mt-1 text-sm text-zinc-400">
            Altere a senha de acesso ao admin.
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Nova senha"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={() => void changePassword()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Salvar senha
            </button>
            {pwdMsg ? (
              <span className="text-sm text-emerald-300">{pwdMsg}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
