import { useCallback, useEffect, useRef, useState } from "react";
import { readPressedButtons, readStickDirection } from "../services/gamepad";

/**
 * Detecta inatividade (teclado, mouse, toque OU gamepad) por `timeoutMs`.
 * Retorna `[idle, reset]`. `reset()` zera manualmente (usado para sair do modo
 * atrair sem deixar o toque de saída vazar para a tela de baixo).
 */
export function useIdle(
  timeoutMs: number,
  enabled = true,
): [boolean, () => void] {
  const [idle, setIdle] = useState(false);
  const idleRef = useRef(false);
  idleRef.current = idle;
  const lastRef = useRef(performance.now());

  const reset = useCallback(() => {
    lastRef.current = performance.now();
    if (idleRef.current) setIdle(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIdle(false);
      return;
    }
    lastRef.current = performance.now();

    const bump = () => {
      lastRef.current = performance.now();
      if (idleRef.current) setIdle(false);
    };
    const events: (keyof WindowEventMap)[] = [
      "keydown",
      "mousemove",
      "mousedown",
      "wheel",
      "touchstart",
    ];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const pressed = readPressedButtons();
      const stick = readStickDirection();
      if (
        pressed.size > 0 ||
        stick.up ||
        stick.down ||
        stick.left ||
        stick.right
      ) {
        lastRef.current = performance.now();
        if (idleRef.current) setIdle(false);
        return;
      }
      if (!idleRef.current && performance.now() - lastRef.current >= timeoutMs) {
        setIdle(true);
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      cancelAnimationFrame(raf);
    };
  }, [enabled, timeoutMs]);

  return [idle, reset];
}
