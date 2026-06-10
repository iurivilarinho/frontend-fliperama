import axios from "axios";
import type {
  CreatePixChargeRequest,
  PixOrder,
  PixPaymentStatus,
} from "./types";

// ── Configuração ──────────────────────────────────────────────────────────
// Base URL do backend de pagamento. Cai para a API de checklist se não houver
// uma dedicada (mesmo padrão dos demais serviços).
const PAYMENT_API_URL =
  (import.meta.env.VITE_PAYMENT_API_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_CHECKLIST_API_URL as string | undefined)?.trim() ||
  "";

const CREATE_PIX_PATH = "/payments/pix";
const PIX_STATUS_PATH = (id: number | string) =>
  `/payments/pix/${encodeURIComponent(String(id))}/status`;

function readBoolEnv(value: unknown, fallback: boolean): boolean {
  if (value == null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

/**
 * Em DESENVOLVIMENTO o pagamento é dispensado (passa direto), conforme pedido.
 * Pode forçar com VITE_PAYMENT_BYPASS=true|false.
 * Em build de produção, o padrão é exigir o pagamento.
 */
export const PAYMENT_BYPASS = readBoolEnv(
  import.meta.env.VITE_PAYMENT_BYPASS,
  Boolean(import.meta.env.DEV),
);

/**
 * Modo mock: gera uma cobrança falsa (para visualizar a tela de QR sem backend).
 * Ativado por padrão quando o bypass está ligado mas você quer ver a tela
 * (VITE_PAYMENT_MOCK=true).
 */
export const PAYMENT_MOCK = readBoolEnv(import.meta.env.VITE_PAYMENT_MOCK, false);

export const paymentApi = axios.create({
  baseURL: PAYMENT_API_URL,
  withCredentials: true,
});

// ── Mock (preview sem backend) ─────────────────────────────────────────────
function buildMockOrder(request: CreatePixChargeRequest): PixOrder {
  // Código copia-e-cola de exemplo (NÃO é um PIX real — apenas para preview).
  const sampleCopiaECola =
    "00020126580014BR.GOV.BCB.PIX0136totem-fliperama-EXEMPLO-NAO-PAGUE520400005303986540" +
    request.amount.toFixed(2) +
    "5802BR5909FLIPERAMA6009SAO PAULO62070503***6304ABCD";

  return {
    id: `mock-${request.durationMinutes}min`,
    status: "pending",
    status_detail: "pending_waiting_transfer",
    payment_method_id: "pix",
    transaction_amount: request.amount,
    date_of_expiration: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    point_of_interaction: {
      transaction_data: {
        qr_code: sampleCopiaECola,
        qr_code_base64: null,
        ticket_url: null,
      },
    },
  };
}

// ── API ────────────────────────────────────────────────────────────────────
export async function createPixCharge(
  request: CreatePixChargeRequest,
): Promise<PixOrder> {
  if (PAYMENT_MOCK) {
    return buildMockOrder(request);
  }

  const { data } = await paymentApi.post<PixOrder>(CREATE_PIX_PATH, request);
  return data;
}

export async function getPixPaymentStatus(
  id: number | string,
): Promise<PixPaymentStatus> {
  if (PAYMENT_MOCK) {
    // No mock o status é controlado pela própria tela (botão de simular).
    return { id, status: "pending" };
  }

  const { data } = await paymentApi.get<PixPaymentStatus>(PIX_STATUS_PATH(id));
  return data;
}
