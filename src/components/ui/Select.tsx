import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/mergeClasses";
import { fieldBase } from "./field";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  className?: string;
};

/** Select padrão do admin — mesma altura/estilo do Input (via `fieldBase`). */
export const Select = ({ className, children, ...props }: SelectProps) => {
  return (
    <select className={cn(fieldBase, className)} {...props}>
      {children}
    </select>
  );
};
