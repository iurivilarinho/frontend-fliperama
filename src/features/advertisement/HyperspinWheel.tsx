import { useMemo } from "react";

export type HyperspinWheelItem = {
  key: string;
  label: string;
  imageUrl: string | null;
};

type HyperspinWheelProps = {
  items: HyperspinWheelItem[];
  selectedIndex: number;
  onSelect?: (index: number) => void;
  disabled?: boolean;
  /** Lado em que a roda fica ancorada (estilo HyperSpin = direita). */
  side?: "left" | "right";
};

// Quantidade de itens visíveis acima/abaixo do selecionado.
const WINDOW = 5;
// Graus por item ao longo do arco.
const ANGLE_STEP = 12;
// Profundidade horizontal da curva (px).
const CURVE_RADIUS = 460;
// Espaçamento vertical entre itens (px).
const VERTICAL_SPACING = 104;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function HyperspinWheel({
  items,
  selectedIndex,
  onSelect,
  disabled = false,
  side = "right",
}: HyperspinWheelProps) {
  const visibleItems = useMemo(() => {
    return items
      .map((item, index) => ({ item, index, offset: index - selectedIndex }))
      .filter((entry) => Math.abs(entry.offset) <= WINDOW);
  }, [items, selectedIndex]);

  const directionSign = side === "right" ? -1 : 1;
  const anchorClass = side === "right" ? "right-[5%]" : "left-[5%]";
  const originClass = side === "right" ? "origin-right" : "origin-left";
  const itemAlignClass = side === "right" ? "justify-end" : "justify-start";

  return (
    <div
      className={[
        "pointer-events-none absolute top-1/2 z-30 h-0 w-[46%] -translate-y-1/2",
        anchorClass,
      ].join(" ")}
    >
      {visibleItems.map(({ item, index, offset }) => {
        const absOffset = Math.abs(offset);
        const isSelected = offset === 0;

        const angleRad = (offset * ANGLE_STEP * Math.PI) / 180;
        const translateY = offset * VERTICAL_SPACING;
        const translateX =
          directionSign * (1 - Math.cos(angleRad)) * CURVE_RADIUS;
        const rotate = -directionSign * offset * (ANGLE_STEP * 0.35);

        const scale = clamp(1 - absOffset * 0.13, 0.42, 1);
        const opacity = clamp(1 - absOffset * 0.2, 0.14, 1);

        return (
          <button
            key={item.key}
            type="button"
            disabled={disabled}
            onClick={() => onSelect?.(index)}
            className={[
              "pointer-events-auto absolute flex h-[92px] w-full items-center",
              itemAlignClass,
              originClass,
              "transition-all duration-300 ease-out disabled:cursor-wait",
            ].join(" ")}
            style={{
              transform: `translate(${translateX}px, ${translateY}px) rotate(${rotate}deg) scale(${scale})`,
              opacity,
              zIndex: 100 - absOffset,
              filter: isSelected
                ? "drop-shadow(0 6px 26px rgba(0,0,0,0.65))"
                : "drop-shadow(0 3px 12px rgba(0,0,0,0.55))",
            }}
          >
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.label}
                draggable={false}
                className={[
                  "max-h-full object-contain transition-all duration-300",
                  side === "right" ? "object-right" : "object-left",
                  isSelected ? "max-w-[100%]" : "max-w-[82%]",
                ].join(" ")}
              />
            ) : (
              <span
                className={[
                  "truncate font-black uppercase tracking-wide",
                  side === "right" ? "text-right" : "text-left",
                  isSelected
                    ? "text-4xl text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                    : absOffset === 1
                      ? "text-2xl text-zinc-200"
                      : "text-xl text-zinc-400",
                ].join(" ")}
              >
                {item.label}
              </span>
            )}
          </button>
        );
      })}

      {/* Marcador do item selecionado (estilo "ponteiro" do HyperSpin). */}
      <div
        className={[
          "absolute top-1/2 h-[78px] w-1.5 -translate-y-1/2 rounded-full bg-white/90",
          "shadow-[0_0_22px_rgba(255,255,255,0.55)]",
          side === "right" ? "-right-3" : "-left-3",
        ].join(" ")}
      />
    </div>
  );
}
