import { useEffect, useState } from "react";
import { loadAttractItems, type AttractItem } from "../../services/attractService";
import { Spinner } from "../../components/spinner/Spinner";

const CYCLE_MS = 12000;

/**
 * Modo atrair: tela cheia rolando vídeos/artes de jogos aleatórios quando o
 * totem fica ocioso, para chamar clientes. Qualquer toque/botão sai (o evento de
 * saída é engolido para não acionar a tela de baixo) via `onExit`.
 */
export function AttractMode({ onExit }: { onExit: () => void }) {
  const [items, setItems] = useState<AttractItem[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let active = true;
    loadAttractItems()
      .then((it) => {
        if (active) setItems(it);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const timer = window.setInterval(
      () => setIdx((i) => (i + 1) % items.length),
      CYCLE_MS,
    );
    return () => window.clearInterval(timer);
  }, [items.length]);

  // Sai no primeiro input e ENGOLE o evento (não vaza pra tela de baixo).
  useEffect(() => {
    const exit = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      onExit();
    };
    const opts = { capture: true } as AddEventListenerOptions;
    window.addEventListener("keydown", exit, opts);
    window.addEventListener("pointerdown", exit, opts);
    return () => {
      window.removeEventListener("keydown", exit, opts);
      window.removeEventListener("pointerdown", exit, opts);
    };
  }, [onExit]);

  const item = items[idx] ?? null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black">
      {item?.videoUrl ? (
        <video
          key={item.videoUrl}
          src={item.videoUrl}
          autoPlay
          muted
          loop
          className="h-full w-full object-contain"
        />
      ) : item?.imageUrl ? (
        <img
          key={item.imageUrl}
          src={item.imageUrl}
          alt=""
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div className="text-5xl font-black tracking-tight text-white">
            FLIPERAMA
          </div>
          <Spinner className="size-16" />
        </div>
      )}

      {/* legenda do jogo */}
      {item ? (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-10">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">
            {item.platform}
          </div>
          <div className="mt-1 text-4xl font-black text-white drop-shadow-lg">
            {item.name}
          </div>
        </div>
      ) : null}

      {/* chamada */}
      <div className="pointer-events-none absolute inset-x-0 top-10 text-center">
        <span className="animate-pulse rounded-full bg-emerald-500/90 px-6 py-2 text-lg font-bold text-zinc-950">
          APERTE QUALQUER BOTÃO PARA JOGAR
        </span>
      </div>
    </div>
  );
}
