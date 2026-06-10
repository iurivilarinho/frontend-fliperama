// Preço (em reais) por tempo de sessão. Ajuste à vontade.
export const PRICE_BY_MINUTES: Record<number, number> = {
  5: 2.0,
  10: 3.0,
  15: 5.0,
};

const DEFAULT_PRICE_PER_MINUTE = 0.5;

export function getPriceForMinutes(minutes: number): number {
  return PRICE_BY_MINUTES[minutes] ?? minutes * DEFAULT_PRICE_PER_MINUTE;
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
