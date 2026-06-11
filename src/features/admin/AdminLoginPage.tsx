import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthContext";
import { RESET_FILENAME } from "../../services/adminAuth";
import { Spinner } from "../../components/spinner/Spinner";

export function AdminLoginPage() {
  const { login, setupPassword, passwordSet } = useAdminAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const firstRun = passwordSet === false;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (firstRun) {
        if (password.trim().length < 3) {
          setError("A senha precisa de ao menos 3 caracteres.");
          return;
        }
        if (password !== confirm) {
          setError("As senhas não conferem.");
          return;
        }
        await setupPassword(password.trim());
        navigate("/admin");
        return;
      }

      const ok = await login(password);
      if (ok) {
        navigate("/admin");
      } else {
        setError("Senha incorreta.");
      }
    } catch (caught) {
      console.error("Erro no login admin:", caught);
      setError("Não foi possível validar a senha (banco indisponível).");
    } finally {
      setLoading(false);
    }
  };

  // Enquanto verifica se já há senha cadastrada.
  if (passwordSet === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
        <Spinner className="size-12" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl"
      >
        <img
          src="/logo.png"
          alt="Retro Nexus"
          className="mx-auto mb-4 h-20 w-20 object-contain"
        />
        <h1 className="text-xl font-bold">
          {firstRun ? "Definir senha do admin" : "Painel administrativo"}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {firstRun
            ? "Primeira vez: crie a senha de acesso ao painel."
            : "Informe a senha para continuar."}
        </p>

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={firstRun ? "Nova senha" : "Senha"}
          className="mt-6 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm outline-none focus:border-emerald-400"
        />

        {firstRun ? (
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirme a senha"
            className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm outline-none focus:border-emerald-400"
          />
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || !password}
          className="mt-6 w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {loading
            ? "Aguarde..."
            : firstRun
              ? "Criar senha e entrar"
              : "Entrar"}
        </button>

        {firstRun ? null : (
          <p className="mt-4 text-center text-xs text-zinc-600">
            Esqueceu? Crie um arquivo{" "}
            <span className="font-mono text-zinc-400">{RESET_FILENAME}</span> na
            pasta raiz dos dados e reabra o painel para redefinir.
          </p>
        )}
      </form>
    </div>
  );
}
