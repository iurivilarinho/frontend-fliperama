import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AdminPageHeader } from "../AdminLayout";
import {
  createTier,
  deleteTier,
  listAllTiers,
  updateTier,
  type PricingTier,
} from "../../../services/db/pricing";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function PricingPage() {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newMinutes, setNewMinutes] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTiers(await listAllTiers());
    } catch (caught) {
      console.error(caught);
      setError("Não foi possível carregar as faixas (banco indisponível).");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    const minutes = Math.max(1, Math.floor(Number(newMinutes)));
    const price = Number(newPrice.replace(",", "."));
    if (!Number.isFinite(minutes) || minutes < 1) return;
    if (!Number.isFinite(price) || price < 0) return;

    await createTier(minutes, Math.round(price * 100));
    setNewMinutes("");
    setNewPrice("");
    await load();
  };

  const handleUpdate = async (
    id: number,
    patch: Partial<Pick<PricingTier, "minutes" | "priceCents" | "active">>,
  ) => {
    await updateTier(id, patch);
    await load();
  };

  const handleDelete = async (id: number) => {
    await deleteTier(id);
    await load();
  };

  return (
    <div>
      <AdminPageHeader
        title="Precificação"
        description="Faixas de tempo e valores. O totem calcula o preço automaticamente conforme o tempo escolhido. Tempo mínimo: 1 minuto."
      />

      <div className="p-8">
        {/* nova faixa */}
        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-400">Minutos</span>
            <input
              type="number"
              min={1}
              value={newMinutes}
              onChange={(e) => setNewMinutes(e.target.value)}
              className="w-28 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none focus:border-emerald-400"
              placeholder="1"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-400">Valor (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="w-32 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 outline-none focus:border-emerald-400"
              placeholder="1,50"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleAdd()}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" /> Adicionar faixa
          </button>
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-zinc-400">Carregando...</p>
        ) : tiers.length === 0 ? (
          <p className="text-sm text-zinc-400">Nenhuma faixa cadastrada.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-left text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Minutos</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Ativa</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => (
                  <tr key={tier.id} className="border-t border-zinc-800">
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        defaultValue={tier.minutes}
                        onBlur={(e) => {
                          const v = Math.max(1, Math.floor(Number(e.target.value)));
                          if (v !== tier.minutes) void handleUpdate(tier.id, { minutes: v });
                        }}
                        className="w-24 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={(tier.priceCents / 100)
                            .toFixed(2)
                            .replace(".", ",")}
                          onBlur={(e) => {
                            const v = Math.round(
                              Number(e.target.value.replace(",", ".")) * 100,
                            );
                            if (Number.isFinite(v) && v !== tier.priceCents)
                              void handleUpdate(tier.id, { priceCents: v });
                          }}
                          className="w-28 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1"
                        />
                        <span className="text-xs text-zinc-500">
                          {formatBRL(tier.priceCents)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={tier.active}
                        onChange={(e) =>
                          void handleUpdate(tier.id, { active: e.target.checked })
                        }
                        className="h-4 w-4 accent-emerald-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDelete(tier.id)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
