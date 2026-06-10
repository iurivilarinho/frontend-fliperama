import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthContext";

export function AdminLoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
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

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl"
      >
        <h1 className="text-xl font-bold">Painel administrativo</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Informe a senha para continuar.
        </p>

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          className="mt-6 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm outline-none focus:border-emerald-400"
        />

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || !password}
          className="mt-6 w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="mt-4 text-center text-xs text-zinc-600">
          Senha padrão inicial: <span className="font-mono">admin</span>
        </p>
      </form>
    </div>
  );
}
