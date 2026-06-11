import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Save, HelpCircle } from "lucide-react";
import { AdminPageHeader } from "../AdminLayout";
import {
  getBezelEnabled,
  getCrtShaderEnabled,
  getPaymentEnabled,
  getShowWithoutRoms,
  setAdminPassword,
  setBezelEnabled,
  setCrtShaderEnabled,
  setPaymentEnabled,
  setShowWithoutRoms,
} from "../../../services/db/settings";
import { applySavedInGameMapping } from "../../../services/emulatorInput";
import { Spinner } from "../../../components/spinner/Spinner";
import { Button, Input } from "../../../components/ui";
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

/** Ícone "?" que mostra/esconde a descrição do campo ao clicar. Fecha ao clicar fora. */
function HelpHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle">
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
    help: "Pasta principal que contém Emulators, Media e Databases (ex.: D:\\HD\\fliperama-data). É a ÚNICA pasta que você informa — o resto (MAME, mídia, bancos, temas) é resolvido automaticamente a partir dela.",
    kind: "folder",
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
  const [paymentEnabled, setPaymentState] = useState(true);
  const [crtShader, setCrtState] = useState(false);
  const [bezel, setBezelState] = useState(false);
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
      setPaymentState(await getPaymentEnabled());
      setCrtState(await getCrtShaderEnabled());
      setBezelState(await getBezelEnabled());
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

  const togglePayment = async (v: boolean) => {
    setPaymentState(v);
    await setPaymentEnabled(v);
    // Aplica no totem sem precisar reiniciar.
    window.dispatchEvent(new Event("payment-config-updated"));
  };

  const toggleCrt = async (v: boolean) => {
    setCrtState(v);
    await setCrtShaderEnabled(v);
    await applySavedInGameMapping().catch(() => {});
  };

  const toggleBezel = async (v: boolean) => {
    setBezelState(v);
    await setBezelEnabled(v);
    await applySavedInGameMapping().catch(() => {});
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
            <Spinner className="size-5" />
          ) : (
            <div className="space-y-4">
              {FIELDS.map((field) => (
                <label key={field.key} className="block text-sm">
                  <span className="mb-1 flex items-center text-zinc-400">
                    {field.label}
                    <HelpHint text={field.help} />
                  </span>
                  <div className="flex gap-2">
                    <Input
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
                      className="min-w-0 flex-1"
                    />
                    {field.kind === "folder" || field.kind === "file" ? (
                      <Button
                        variant="secondary"
                        onClick={() => void pickPath(field)}
                        className="shrink-0"
                      >
                        <FolderOpen className="h-4 w-4" /> Selecionar
                      </Button>
                    ) : null}
                  </div>
                </label>
              ))}

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={() => void saveConfig()} disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar configurações"}
                </Button>
                {cfgMsg ? (
                  <span className="text-sm text-emerald-300">{cfgMsg}</span>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Tela de pagamento / modo livre */}
        <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div>
            <div className="flex items-center font-semibold">
              Cobrança (tela de pagamento)
              <HelpHint text="Ligado (padrão): o totem mostra a tela de pagamento PIX e a sessão é por tempo. Desligado (modo livre): pula o pagamento e a máquina fica liberada para jogar sem tempo — use quando o acesso for por pacote mensal, não por PIX." />
            </div>
            <div className="mt-1 max-w-xl text-sm text-zinc-400">
              Desligue para o <span className="text-zinc-300">modo livre</span>{" "}
              (pacote mensal): sem tela de pagamento, máquina liberada.
            </div>
          </div>
          {loading ? (
            <Spinner className="size-5" />
          ) : (
            <Toggle
              checked={paymentEnabled}
              onChange={(v) => void togglePayment(v)}
            />
          )}
        </div>

        {/* Visual dos jogos: shader CRT + bezel */}
        <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div>
            <div className="flex items-center font-semibold">
              Shader CRT (scanlines)
              <HelpHint text="Aplica um filtro de TV de tubo (scanlines/curvatura) nos jogos do RetroArch, dando o visual retrô autêntico. Pode pesar um pouco em máquinas fracas. Vale no próximo jogo aberto." />
            </div>
            <div className="mt-1 max-w-xl text-sm text-zinc-400">
              Visual de TV antiga nos jogos (RetroArch).
            </div>
          </div>
          {loading ? (
            <Spinner className="size-5" />
          ) : (
            <Toggle checked={crtShader} onChange={(v) => void toggleCrt(v)} />
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div>
            <div className="flex items-center font-semibold">
              Moldura (bezel)
              <HelpHint text="Mostra uma moldura de arcade em volta do jogo (preenche as laterais pretas da tela), dando aparência de fliperama. Vale no próximo jogo aberto do RetroArch." />
            </div>
            <div className="mt-1 max-w-xl text-sm text-zinc-400">
              Moldura em volta do jogo (preenche as bordas da tela).
            </div>
          </div>
          {loading ? (
            <Spinner className="size-5" />
          ) : (
            <Toggle checked={bezel} onChange={(v) => void toggleBezel(v)} />
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
            <Spinner className="size-5" />
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
            <Input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Nova senha"
            />
            <Button onClick={() => void changePassword()}>Salvar senha</Button>
            {pwdMsg ? (
              <span className="text-sm text-emerald-300">{pwdMsg}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
