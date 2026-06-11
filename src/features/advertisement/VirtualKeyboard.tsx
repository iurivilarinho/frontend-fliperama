import { useEffect, useRef, useState } from "react";

type Props = {
  onChar: (char: string) => void;
  onBackspace: () => void;
  onDone: () => void;
};

const ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
  ["ESPAÇO", "APAGAR", "PRONTO"],
];

/**
 * Teclado virtual navegável pelo controle (setas movem, confirmar seleciona).
 * Para buscar jogos no modo arcade/fliperama, onde não há teclado físico.
 * Captura as setas/Enter/Esc para não vazar para a navegação do wheel.
 */
export function VirtualKeyboard({ onChar, onBackspace, onDone }: Props) {
  const [sel, setSel] = useState<[number, number]>([1, 0]);
  const selRef = useRef(sel);
  selRef.current = sel;

  useEffect(() => {
    const move = (dr: number, dc: number) => {
      const [r0, c0] = selRef.current;
      let r = Math.min(Math.max(r0 + dr, 0), ROWS.length - 1);
      let c = c0 + dc;
      if (c < 0) c = ROWS[r].length - 1;
      if (c >= ROWS[r].length) c = 0;
      // ao trocar de linha, mantém a coluna dentro do limite
      if (dr !== 0) c = Math.min(c0, ROWS[r].length - 1);
      setSel([r, c]);
    };

    const activate = () => {
      const [r, c] = selRef.current;
      const key = ROWS[r]?.[c];
      if (!key) return;
      if (key === "ESPAÇO") onChar(" ");
      else if (key === "APAGAR") onBackspace();
      else if (key === "PRONTO") onDone();
      else onChar(key.toLowerCase());
    };

    const handler = (e: KeyboardEvent) => {
      const k = e.key;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"].includes(k)
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (k === "ArrowLeft") move(0, -1);
      else if (k === "ArrowRight") move(0, 1);
      else if (k === "ArrowUp") move(-1, 0);
      else if (k === "ArrowDown") move(1, 0);
      else if (k === "Enter") activate();
      else if (k === "Escape") onDone();
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, {
        capture: true,
      } as EventListenerOptions);
  }, [onChar, onBackspace, onDone]);

  return (
    <div className="mt-3 rounded-2xl border border-zinc-700 bg-black/80 p-4 backdrop-blur-md">
      <div className="space-y-2">
        {ROWS.map((row, r) => (
          <div key={r} className="flex justify-center gap-2">
            {row.map((key, c) => {
              const active = sel[0] === r && sel[1] === c;
              const wide = key.length > 1;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSel([r, c]);
                    if (key === "ESPAÇO") onChar(" ");
                    else if (key === "APAGAR") onBackspace();
                    else if (key === "PRONTO") onDone();
                    else onChar(key.toLowerCase());
                  }}
                  className={[
                    "flex h-11 items-center justify-center rounded-lg text-sm font-bold transition",
                    wide ? "px-4" : "w-11",
                    active
                      ? "scale-110 bg-emerald-500 text-zinc-950 shadow-[0_0_18px_rgba(16,185,129,0.5)]"
                      : "bg-zinc-800 text-zinc-200",
                  ].join(" ")}
                >
                  {key === "APAGAR" ? "⌫ APAGAR" : key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 text-center text-xs text-zinc-500">
        Use o direcional para mover • Confirmar seleciona • Voltar fecha
      </div>
    </div>
  );
}
