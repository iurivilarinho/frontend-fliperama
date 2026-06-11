import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/mergeClasses";
import { fieldBase } from "./field";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
};

/** Input de texto padrão do admin (altura/estilo consistentes via `fieldBase`). */
export const Input = ({ className, type = "text", ...props }: InputProps) => {
  return (
    <input
      type={type}
      className={cn(fieldBase, "placeholder:text-zinc-500", className)}
      {...props}
    />
  );
};
