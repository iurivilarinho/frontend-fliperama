import { Gamepad2 } from "lucide-react";
import { cn } from "../../lib/mergeClasses";

/**
 * Spinner com cara de plataforma de games: um anel girando (verde do tema) com
 * um controle pulsando no centro. O tamanho vem da className (ex.: "size-12").
 */
function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={cn(
        "relative inline-flex size-10 items-center justify-center",
        className,
      )}
    >
      {/* anel externo girando */}
      <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-emerald-500/20 border-t-emerald-400 [animation-duration:0.9s]" />
      {/* brilho suave */}
      <span className="absolute inset-1 rounded-full bg-emerald-500/5 blur-sm" />
      {/* controle pulsando no centro */}
      <Gamepad2 className="h-1/2 w-1/2 animate-pulse text-emerald-400" />
    </span>
  );
}

export { Spinner };
