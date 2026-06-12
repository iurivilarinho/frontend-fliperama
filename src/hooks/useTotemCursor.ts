import { useEffect } from "react";
import { loadSelectedPreset } from "../services/db/controls";

/**
 * Política de cursor do mouse — usada SOMENTE nas telas do totem (seleção de
 * plataforma, pagamento, lista de jogos):
 * - Controle "PC" (ou ainda não escolhido) → mostra um cursor estilizado de jogo.
 * - Qualquer outro controle (Xbox/PlayStation/fliperama) → esconde o cursor,
 *   pois joga-se no controle e o ponteiro só atrapalharia.
 *
 * A tela de admin NÃO usa este hook de propósito: lá o cursor fica SEMPRE
 * visível (independente do controle), porque o painel é operado no mouse. Ao
 * sair do totem para o admin, o cleanup remove as classes e o cursor volta.
 *
 * Reage à troca de preset no admin via evento `controls-preset-updated`.
 */
export function useTotemCursor(): void {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.location.pathname === "/player-mini"
    ) {
      return;
    }

    let cancelled = false;

    const apply = () => {
      loadSelectedPreset()
        .then((preset) => {
          if (cancelled) return;
          // Vazio = ainda não escolhido = mostra (não trava o setup inicial).
          const showCursor = preset === "" || preset === "pc";
          document.body.classList.toggle("overlay-cursor-hidden", !showCursor);
        })
        .catch(() => {});
    };

    document.body.classList.add("cursor-totem");
    apply();
    window.addEventListener("controls-preset-updated", apply);

    return () => {
      cancelled = true;
      window.removeEventListener("controls-preset-updated", apply);
      document.body.classList.remove("cursor-totem", "overlay-cursor-hidden");
    };
  }, []);
}
