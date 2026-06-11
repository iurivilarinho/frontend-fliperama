import { useEffect, useRef } from "react";
import {
  DEFAULT_MAPPING,
  readPressedButtons,
  readStickDirection,
  type ControlAction,
  type ControlMapping,
} from "../services/gamepad";
import { loadControlMapping } from "../services/db/controls";

const INITIAL_REPEAT_MS = 350;
const REPEAT_MS = 140;

/**
 * Ponte gamepad -> teclado: traduz os botões do controle (mapeamento global do
 * banco) nas teclas que as telas já escutam (setas, Enter, Esc, F, /). Não
 * interfere na área /admin (lá há binding/teste próprios).
 */
export function useGamepadNavigation() {
  const mappingRef = useRef<ControlMapping>(DEFAULT_MAPPING);

  useEffect(() => {
    let active = true;

    const reload = () => {
      loadControlMapping()
        .then((m) => {
          if (active) mappingRef.current = m;
        })
        .catch(() => {});
    };
    reload();
    window.addEventListener("controls-updated", reload);

    const prev = new Set<number>();
    const nextRepeat: Partial<Record<ControlAction, number>> = {};
    let raf = 0;

    const dispatchKey = (key: string) => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true }),
      );
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);

      // No admin não traduzimos (evita disparar navegação enquanto configura).
      if (window.location.pathname.startsWith("/admin")) {
        prev.clear();
        return;
      }

      const m = mappingRef.current;
      const pressed = readPressedButtons();
      const stick = readStickDirection();
      const now = performance.now();

      // Ações de toque único (borda de subida).
      const edge: [ControlAction, string][] = [
        ["confirm", "Enter"],
        ["back", "Escape"],
        ["favorite", "f"],
        ["search", "/"],
      ];
      for (const [action, key] of edge) {
        const idx = m[action];
        if (pressed.has(idx) && !prev.has(idx)) dispatchKey(key);
      }

      // Direcionais (toque + auto-repeat ao segurar), via D-pad mapeado OU analógico.
      const dirs: [ControlAction, string, boolean][] = [
        ["up", "ArrowUp", pressed.has(m.up) || stick.up],
        ["down", "ArrowDown", pressed.has(m.down) || stick.down],
        ["left", "ArrowLeft", pressed.has(m.left) || stick.left],
        ["right", "ArrowRight", pressed.has(m.right) || stick.right],
      ];
      for (const [action, key, held] of dirs) {
        if (held) {
          const due = nextRepeat[action];
          if (due == null) {
            dispatchKey(key);
            nextRepeat[action] = now + INITIAL_REPEAT_MS;
          } else if (now >= due) {
            dispatchKey(key);
            nextRepeat[action] = now + REPEAT_MS;
          }
        } else {
          delete nextRepeat[action];
        }
      }

      prev.clear();
      pressed.forEach((i) => prev.add(i));
    };

    raf = requestAnimationFrame(loop);

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("controls-updated", reload);
    };
  }, []);
}
