import type { ControllerType } from "../../services/gamepad";

export type GamepadVariant =
  | "xbox"
  | "playstation"
  | "fliperama"
  | "generic"
  | "pc";

type Props = {
  pressed: Set<number>;
  variant?: GamepadVariant;
  className?: string;
};

const ON = "#10b981";
const BASE = "#52525b";

export function variantFromType(type: ControllerType): GamepadVariant {
  return type;
}

export function GamepadVisual({
  pressed,
  variant = "generic",
  className = "w-full max-w-xl",
}: Props) {
  const v = variant;
  const fill = (i: number, base = BASE) => (pressed.has(i) ? ON : base);
  const glow = (i: number) => (pressed.has(i) ? "url(#gv-glow)" : "none");

  // d-pad reutilizável (índices 12-15)
  const Dpad = ({ cx, cy }: { cx: number; cy: number }) => (
    <g>
      <rect x={cx - 11} y={cy - 33} width="22" height="22" rx="5" fill={fill(12)} filter={glow(12)} />
      <rect x={cx - 11} y={cy + 11} width="22" height="22" rx="5" fill={fill(13)} filter={glow(13)} />
      <rect x={cx - 33} y={cy - 11} width="22" height="22" rx="5" fill={fill(14)} filter={glow(14)} />
      <rect x={cx + 11} y={cy - 11} width="22" height="22" rx="5" fill={fill(15)} filter={glow(15)} />
      <rect x={cx - 11} y={cy - 11} width="22" height="22" rx="4" fill="#3f3f46" />
    </g>
  );

  const Stick = ({ cx, cy, idx }: { cx: number; cy: number; idx: number }) => (
    <g>
      <circle cx={cx} cy={cy} r="22" fill="#0f0f12" stroke="#3f3f46" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="14" fill={fill(idx, "#3f3f46")} filter={glow(idx)} />
    </g>
  );

  const Face = ({
    cx,
    cy,
    idx,
    label,
    color,
  }: {
    cx: number;
    cy: number;
    idx: number;
    label: string;
    color: string;
  }) => (
    <g fontFamily="sans-serif" fontWeight="700" fontSize="15" textAnchor="middle">
      <circle cx={cx} cy={cy} r="15" fill={fill(idx)} stroke={color} strokeWidth="2.5" filter={glow(idx)} />
      <text x={cx} y={cy + 5} fill={pressed.has(idx) ? "#0a0a0a" : color}>
        {label}
      </text>
    </g>
  );

  const Shoulders = () => (
    <>
      <rect x="78" y="26" width="70" height="18" rx="9" fill={fill(6)} filter={glow(6)} />
      <rect x="292" y="26" width="70" height="18" rx="9" fill={fill(7)} filter={glow(7)} />
      <rect x="84" y="42" width="62" height="16" rx="8" fill={fill(4)} filter={glow(4)} />
      <rect x="294" y="42" width="62" height="16" rx="8" fill={fill(5)} filter={glow(5)} />
    </>
  );

  const defs = (
    <defs>
      <filter id="gv-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id="gv-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#27272a" />
        <stop offset="1" stopColor="#121214" />
      </linearGradient>
    </defs>
  );

  // ── XBOX (sticks assimétricos: stick esq. em cima, d-pad embaixo) ──────────
  if (v === "xbox") {
    return (
      <svg viewBox="0 0 440 270" className={className}>
        {defs}
        <Shoulders />
        <path
          d="M128 70 Q220 50 312 70 Q374 82 382 132 Q390 178 374 210 Q352 250 308 248 Q282 246 268 218 Q256 200 220 200 Q184 200 172 218 Q158 246 132 248 Q88 250 66 210 Q50 178 58 132 Q66 82 128 70 Z"
          fill="url(#gv-body)"
          stroke="#3f3f46"
          strokeWidth="2"
        />
        <Stick cx={108} cy={104} idx={10} />
        <Dpad cx={150} cy={168} />
        <Face cx={322} cy={84} idx={3} label="Y" color="#eab308" />
        <Face cx={322} cy={140} idx={0} label="A" color="#22c55e" />
        <Face cx={294} cy={112} idx={2} label="X" color="#3b82f6" />
        <Face cx={350} cy={112} idx={1} label="B" color="#ef4444" />
        <Stick cx={250} cy={166} idx={11} />
        <rect x="186" y="104" width="22" height="11" rx="5.5" fill={fill(8)} filter={glow(8)} />
        <rect x="226" y="104" width="22" height="11" rx="5.5" fill={fill(9)} filter={glow(9)} />
        <circle cx="217" cy="86" r="9" fill="#27272a" stroke="#3f3f46" />
      </svg>
    );
  }

  // ── PLAYSTATION (sticks simétricos embaixo + touchpad) ─────────────────────
  if (v === "playstation") {
    return (
      <svg viewBox="0 0 440 270" className={className}>
        {defs}
        <Shoulders />
        <path
          d="M150 58 Q220 50 290 58 Q344 64 360 104 Q372 134 372 160 Q396 232 330 236 Q300 238 282 210 Q272 196 262 194 L178 194 Q168 196 158 210 Q140 238 110 236 Q44 232 68 160 Q68 134 80 104 Q96 64 150 58 Z"
          fill="url(#gv-body)"
          stroke="#3f3f46"
          strokeWidth="2"
        />
        <Dpad cx={118} cy={104} />
        <Face cx={322} cy={76} idx={3} label="△" color="#34d399" />
        <Face cx={322} cy={132} idx={0} label="✕" color="#60a5fa" />
        <Face cx={294} cy={104} idx={2} label="□" color="#f0abfc" />
        <Face cx={350} cy={104} idx={1} label="○" color="#f87171" />
        {/* touchpad */}
        <rect x="180" y="74" width="80" height="34" rx="6" fill="#0f0f12" stroke="#3f3f46" strokeWidth="2" />
        {/* share / options */}
        <rect x="158" y="80" width="12" height="14" rx="3" fill={fill(8)} filter={glow(8)} />
        <rect x="270" y="80" width="12" height="14" rx="3" fill={fill(9)} filter={glow(9)} />
        <Stick cx={172} cy={166} idx={10} />
        <Stick cx={268} cy={166} idx={11} />
      </svg>
    );
  }

  // ── PC (teclado + mouse) ───────────────────────────────────────────────────
  if (v === "pc") {
    const keyFill = (i?: number) =>
      i != null && pressed.has(i) ? ON : "#27272a";
    const keyTxt = (i?: number) =>
      i != null && pressed.has(i) ? "#0a0a0a" : "#a1a1aa";
    const Key = ({
      x,
      y,
      w = 26,
      label,
      i,
    }: {
      x: number;
      y: number;
      w?: number;
      label?: string;
      i?: number;
    }) => (
      <g>
        <rect
          x={x}
          y={y}
          width={w}
          height="26"
          rx="4"
          fill={keyFill(i)}
          stroke="#3f3f46"
          filter={i != null ? glow(i) : "none"}
        />
        {label ? (
          <text
            x={x + w / 2}
            y={y + 18}
            fontSize="13"
            fontWeight="700"
            textAnchor="middle"
            fill={keyTxt(i)}
          >
            {label}
          </text>
        ) : null}
      </g>
    );
    return (
      <svg viewBox="0 0 440 260" className={className}>
        {defs}
        {/* teclado */}
        <rect x="18" y="64" width="300" height="166" rx="14" fill="url(#gv-body)" stroke="#3f3f46" strokeWidth="2" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <Key key={n} x={36 + n * 30} y={82} />
        ))}
        {/* WASD (movimento) */}
        <Key x={70} y={116} label="W" i={12} />
        <Key x={44} y={146} label="A" i={14} />
        <Key x={70} y={146} label="S" i={13} />
        <Key x={96} y={146} label="D" i={15} />
        {/* I/J/K/L (botões, layout diamante) */}
        <Key x={196} y={116} label="I" i={3} />
        <Key x={170} y={146} label="J" i={2} />
        <Key x={196} y={146} label="K" i={0} />
        <Key x={222} y={146} label="L" i={1} />
        {/* espaço + enter */}
        <Key x={96} y={188} w={114} label="ESPAÇO" />
        <Key x={216} y={188} w={76} label="Enter" i={9} />
        {/* mouse */}
        <path
          d="M356 88 Q356 70 380 70 Q404 70 404 88 L404 176 Q404 208 380 208 Q356 208 356 176 Z"
          fill="url(#gv-body)"
          stroke="#3f3f46"
          strokeWidth="2"
        />
        <line x1="380" y1="74" x2="380" y2="122" stroke="#3f3f46" strokeWidth="1.5" />
        <rect x="376" y="92" width="8" height="18" rx="4" fill="#3f3f46" />
        <text x="380" y="226" fontSize="11" fontWeight="700" textAnchor="middle" fill="#71717a">
          mouse
        </text>
      </svg>
    );
  }

  // ── FLIPERAMA (arcade stick: manche + cluster de botões) ───────────────────
  if (v === "fliperama") {
    const anyDir = [12, 13, 14, 15].some((i) => pressed.has(i));
    const ARCADE = ["#ef4444", "#eab308", "#22c55e", "#3b82f6", "#f0abfc", "#f97316"];
    const cluster: [number, number, number][] = [
      [250, 120, 0],
      [296, 110, 1],
      [342, 116, 2],
      [256, 166, 3],
      [302, 172, 4],
      [348, 166, 5],
    ];
    return (
      <svg viewBox="0 0 440 250" className={className}>
        {defs}
        <rect x="36" y="46" width="368" height="170" rx="18" fill="url(#gv-body)" stroke="#3f3f46" strokeWidth="2" />
        {/* manche */}
        <circle cx="120" cy="150" r="40" fill="#0f0f12" stroke="#3f3f46" strokeWidth="2" />
        <line x1="120" y1="150" x2="120" y2="150" stroke="#3f3f46" strokeWidth="10" />
        <circle cx="120" cy="150" r="20" fill={anyDir ? ON : "#ef4444"} filter={anyDir ? "url(#gv-glow)" : "none"} />
        <circle cx="120" cy="150" r="7" fill="#0f0f12" opacity="0.35" />
        {/* botões */}
        {cluster.map(([cx, cy, idx]) => (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r="17"
            fill={pressed.has(idx) ? ON : "#1a1a1d"}
            stroke={ARCADE[idx]}
            strokeWidth="3"
            filter={glow(idx)}
          />
        ))}
        {/* start / coin */}
        <rect x="300" y="58" width="24" height="10" rx="5" fill={fill(9)} filter={glow(9)} />
        <rect x="334" y="58" width="24" height="10" rx="5" fill={fill(8)} filter={glow(8)} />
        <text x="312" y="52" fontSize="8" fill="#71717a" textAnchor="middle">START</text>
        <text x="346" y="52" fontSize="8" fill="#71717a" textAnchor="middle">COIN</text>
      </svg>
    );
  }

  // ── GENÉRICO / PC ──────────────────────────────────────────────────────────
  return (
    <svg viewBox="0 0 440 260" className={className}>
      {defs}
      <Shoulders />
      <path
        d="M150 66 Q220 52 290 66 Q366 76 382 146 Q394 218 336 226 Q300 230 280 200 L160 200 Q140 230 104 226 Q46 218 58 146 Q74 76 150 66 Z"
        fill="url(#gv-body)"
        stroke="#3f3f46"
        strokeWidth="2"
      />
      <Dpad cx={120} cy={122} />
      <Face cx={322} cy={96} idx={3} label="4" color="#a1a1aa" />
      <Face cx={322} cy={152} idx={0} label="1" color="#a1a1aa" />
      <Face cx={294} cy={124} idx={2} label="3" color="#a1a1aa" />
      <Face cx={350} cy={124} idx={1} label="2" color="#a1a1aa" />
      <rect x="188" y="100" width="22" height="11" rx="5.5" fill={fill(8)} filter={glow(8)} />
      <rect x="228" y="100" width="22" height="11" rx="5.5" fill={fill(9)} filter={glow(9)} />
      <Stick cx={175} cy={168} idx={10} />
      <Stick cx={265} cy={168} idx={11} />
    </svg>
  );
}
