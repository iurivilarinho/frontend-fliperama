// Tipos do pagamento PIX, espelhando o contrato do backend (Mercado Pago),
// igual ao usado no projeto rifas (OrderMercadoPagoResponse).

export type PixTransactionData = {
  qr_code: string; // copia-e-cola
  qr_code_base64: string | null; // imagem do QR em base64
  ticket_url: string | null;
};

export type PixPointOfInteraction = {
  transaction_data: PixTransactionData | null;
};

export type PixOrder = {
  id: number | string;
  status: string; // "pending" | "approved" | "rejected" | "cancelled" | ...
  status_detail: string | null;
  payment_method_id: string | null;
  transaction_amount: number;
  date_of_expiration: string | null; // ISO
  point_of_interaction: PixPointOfInteraction | null;
};

export type PixPaymentStatus = {
  id: number | string;
  status: string;
  status_detail?: string | null;
};

// Pedido de cobrança de uma sessão de jogo (totem de fliperama).
export type CreatePixChargeRequest = {
  durationMinutes: number;
  amount: number; // em reais (ex.: 5.00)
  description: string;
};

const APPROVED_STATUSES = new Set(["approved", "paid", "accredited"]);
const FAILED_STATUSES = new Set([
  "rejected",
  "cancelled",
  "canceled",
  "refunded",
  "charged_back",
]);

export function isApprovedStatus(status: string | null | undefined): boolean {
  return APPROVED_STATUSES.has((status ?? "").toLowerCase());
}

export function isFailedStatus(status: string | null | undefined): boolean {
  return FAILED_STATUSES.has((status ?? "").toLowerCase());
}
