import type { ControllerType } from "../../services/gamepad";

type Props = {
  pressed: Set<number>;
  type?: ControllerType;
};

// Rótulos e cores das 4 faces por tipo de controle.
const FACE_BY_TYPE: Record<
  ControllerType,
  { south: [string, string]; east: [string, string]; west: [string, string]; north: [string, string] }
> = {
  xbox: {
    south: ["A", "#22c55e"],
    east: ["B", "#ef4444"],
    west: ["X", "#3b82f6"],
    north: ["Y", "#eab308"],
  },
  playstation: {
    south: ["✕", "#60a5fa"],
    east: ["○", "#f87171"],
    west: ["□", "#f0abfc"],
    north: ["△", "#34d399"],
  },
  generic: {
    south: ["1", "#a1a1aa"],
    east: ["2", "#a1a1aa"],
    west: ["3", "#a1a1aa"],
    north: ["4", "#a1a1aa"],
  },
};

export function GamepadVisual({ pressed, type = "generic" }: Props) {
  const faces = FACE_BY_TYPE[type];
  const ON = "#10b981";
  const BASE = "#52525b";

  const fill = (index: number, base = BASE) =>
    pressed.has(index) ? ON : base;
  const glow = (index: number) =>
    pressed.has(index) ? "url(#glow)" : "none";

  return (
    <svg viewBox="0 0 420 280" className="w-full max-w-2xl">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#27272a" />
          <stop offset="1" stopColor="#131316" />
        </linearGradient>
      </defs>

      {/* gatilhos L2/R2 */}
      <rect x="78" y="28" width="70" height="20" rx="10" fill={fill(6)} filter={glow(6)} />
      <rect x="272" y="28" width="70" height="20" rx="10" fill={fill(7)} filter={glow(7)} />
      {/* ombros L1/R1 */}
      <rect x="84" y="44" width="64" height="18" rx="9" fill={fill(4)} filter={glow(4)} />
      <rect x="272" y="44" width="64" height="18" rx="9" fill={fill(5)} filter={glow(5)} />

      {/* corpo */}
      <path
        d="M120 70 Q210 52 300 70 Q360 78 372 140 Q384 210 332 226 Q300 234 280 206 L140 206 Q120 234 88 226 Q36 210 48 140 Q60 78 120 70 Z"
        fill="url(#body)"
        stroke="#3f3f46"
        strokeWidth="2"
      />

      {/* D-pad */}
      <g>
        <rect x="104" y="104" width="22" height="22" rx="5" fill={fill(12)} filter={glow(12)} />
        <rect x="104" y="150" width="22" height="22" rx="5" fill={fill(13)} filter={glow(13)} />
        <rect x="80" y="127" width="22" height="22" rx="5" fill={fill(14)} filter={glow(14)} />
        <rect x="128" y="127" width="22" height="22" rx="5" fill={fill(15)} filter={glow(15)} />
        <rect x="104" y="127" width="22" height="22" rx="4" fill="#3f3f46" />
      </g>

      {/* faces (diamante) */}
      <g fontFamily="sans-serif" fontWeight="700" fontSize="15" textAnchor="middle">
        {/* north */}
        <circle cx="312" cy="104" r="15" fill={fill(3)} stroke={faces.north[1]} strokeWidth="2.5" filter={glow(3)} />
        <text x="312" y="109" fill={pressed.has(3) ? "#0a0a0a" : faces.north[1]}>{faces.north[0]}</text>
        {/* south */}
        <circle cx="312" cy="160" r="15" fill={fill(0)} stroke={faces.south[1]} strokeWidth="2.5" filter={glow(0)} />
        <text x="312" y="165" fill={pressed.has(0) ? "#0a0a0a" : faces.south[1]}>{faces.south[0]}</text>
        {/* west */}
        <circle cx="284" cy="132" r="15" fill={fill(2)} stroke={faces.west[1]} strokeWidth="2.5" filter={glow(2)} />
        <text x="284" y="137" fill={pressed.has(2) ? "#0a0a0a" : faces.west[1]}>{faces.west[0]}</text>
        {/* east */}
        <circle cx="340" cy="132" r="15" fill={fill(1)} stroke={faces.east[1]} strokeWidth="2.5" filter={glow(1)} />
        <text x="340" y="137" fill={pressed.has(1) ? "#0a0a0a" : faces.east[1]}>{faces.east[0]}</text>
      </g>

      {/* select / start */}
      <rect x="178" y="104" width="24" height="11" rx="5.5" fill={fill(8)} filter={glow(8)} />
      <rect x="218" y="104" width="24" height="11" rx="5.5" fill={fill(9)} filter={glow(9)} />

      {/* analógicos (L3/R3 ao clicar) */}
      <circle cx="170" cy="170" r="22" fill="#131316" stroke="#3f3f46" strokeWidth="2" />
      <circle cx="170" cy="170" r="14" fill={fill(10, "#3f3f46")} filter={glow(10)} />
      <circle cx="250" cy="170" r="22" fill="#131316" stroke="#3f3f46" strokeWidth="2" />
      <circle cx="250" cy="170" r="14" fill={fill(11, "#3f3f46")} filter={glow(11)} />
    </svg>
  );
}
