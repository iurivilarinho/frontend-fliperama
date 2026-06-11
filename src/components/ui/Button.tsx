import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/mergeClasses";

// Botão do admin. Altura fixa (h-10/h-8) alinha com Input/Select. Variantes
// cobrem os usos reais: ação principal, secundária, destrutiva e discreta.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-emerald-500 text-zinc-950 hover:bg-emerald-400",
        secondary:
          "border border-zinc-600 bg-zinc-800 text-zinc-100 hover:border-emerald-400",
        danger: "text-red-400 hover:bg-red-500/10",
        ghost: "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
      },
      size: {
        md: "h-10 px-4 text-sm",
        sm: "h-8 px-3 text-xs",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    className?: string;
  };

export const Button = ({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) => {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
};
