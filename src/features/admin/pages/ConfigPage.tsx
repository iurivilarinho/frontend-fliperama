import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "../AdminLayout";
import {
  getShowWithoutRoms,
  setAdminPassword,
  setShowWithoutRoms,
} from "../../../services/db/settings";

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

export function ConfigPage() {
  const [showWithoutRoms, setShowState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pwd, setPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setShowState(await getShowWithoutRoms());
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

  return (
    <div>
      <AdminPageHeader
        title="Configurações"
        description="Ajustes gerais do totem."
      />
      <div className="space-y-6 p-8">
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
