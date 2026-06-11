/**
 * Tela de abertura: a logo Retro Nexus surge com uma animaçãozinha (escala +
 * brilho) quando o app abre. É exibida por alguns segundos e some com fade.
 */
export function Splash({ hiding }: { hiding: boolean }) {
  return (
    <div
      className={[
        "fixed inset-0 z-[200] flex items-center justify-center bg-zinc-950 transition-opacity duration-500",
        hiding ? "pointer-events-none opacity-0" : "opacity-100",
      ].join(" ")}
    >
      <img
        src="/logo.png"
        alt="Retro Nexus"
        className="animate-splash-in h-64 w-64 object-contain sm:h-80 sm:w-80"
      />
    </div>
  );
}
