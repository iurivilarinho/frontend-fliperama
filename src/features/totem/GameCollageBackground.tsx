import { useEffect, useState } from "react";
import { loadAttractItems } from "../../services/attractService";

/**
 * Fundo decorativo: mosaico desfocado de artes de jogos da biblioteca, com véu
 * escuro por cima para o conteúdo continuar legível. Usado atrás do card de
 * pagamento para dar cara de plataforma de games.
 */
export function GameCollageBackground() {
  const [imgs, setImgs] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    loadAttractItems(30)
      .then((items) => {
        if (!active) return;
        const urls = items
          .map((i) => i.imageUrl)
          .filter((u): u is string => Boolean(u));
        setImgs(urls.slice(0, 18));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (imgs.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <div className="grid h-full w-full grid-cols-3 gap-1 opacity-45 blur-[2px] sm:grid-cols-5 lg:grid-cols-6">
        {imgs.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ))}
      </div>
      {/* véu escuro para legibilidade do card */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/85 via-zinc-950/75 to-zinc-950/90" />
    </div>
  );
}
