import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Junta classes condicionais (clsx) e resolve conflitos do Tailwind
 * (tailwind-merge): a última classe vence. Use em todo `className`.
 * @param classes Valores de classe.
 * @returns String de classes combinadas.
 */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(...classes));
}
