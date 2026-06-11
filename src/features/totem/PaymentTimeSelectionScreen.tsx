import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  createPixCharge,
  getPixPaymentStatus,
  PAYMENT_BYPASS,
  PAYMENT_MOCK,
} from "../../services/payment/paymentService";
import {
  isApprovedStatus,
  isFailedStatus,
  type PixOrder,
} from "../../services/payment/types";
import { formatBRL, getPriceForMinutes } from "./session/pricing";
import { listActiveTiers } from "../../services/db/pricing";
import type { SessionPaymentInfo } from "./session/PlaySessionContext";
import { GameCollageBackground } from "./GameCollageBackground";

type PaymentTimeSelectionScreenProps = {
  durationOptionsMinutes: readonly number[];
  onSelectDuration: (minutes: number, payment?: SessionPaymentInfo) => void;
};

type PriceOption = { minutes: number; price: number };

type Step = "choose" | "pay";

const POLL_INTERVAL_MS = 3000;

function formatMsToMMSS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PaymentTimeSelectionScreen({
  durationOptionsMinutes,
  onSelectDuration,
}: PaymentTimeSelectionScreenProps) {
  const [step, setStep] = useState<Step>("choose");
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [order, setOrder] = useState<PixOrder | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  const grantedRef = useRef(false);

  // Faixas de preço: carregadas do banco (admin). Cai para o config estático
  // se o banco não estiver disponível (ambiente web/dev sem Tauri).
  const [priceOptions, setPriceOptions] = useState<PriceOption[]>(() =>
    durationOptionsMinutes.map((m) => ({
      minutes: m,
      price: getPriceForMinutes(m),
    })),
  );

  useEffect(() => {
    let active = true;
    listActiveTiers()
      .then((tiers) => {
        if (!active || tiers.length === 0) return;
        setPriceOptions(
          tiers.map((t) => ({ minutes: t.minutes, price: t.priceCents / 100 })),
        );
      })
      .catch(() => {
        // mantém o fallback estático
      });
    return () => {
      active = false;
    };
  }, [durationOptionsMinutes]);

  const priceForMinutes = useCallback(
    (minutes: number): number => {
      const found = priceOptions.find((o) => o.minutes === minutes);
      if (found) return found.price;
      return getPriceForMinutes(minutes);
    },
    [priceOptions],
  );

  const grantAccess = useCallback(
    (minutes: number) => {
      if (grantedRef.current) return;
      grantedRef.current = true;
      const amountCents = Math.round(priceForMinutes(minutes) * 100);
      const providerId = order?.id != null ? String(order.id) : null;
      onSelectDuration(minutes, { amountCents, providerId, status: "approved" });
    },
    [onSelectDuration, priceForMinutes, order],
  );

  const startPaymentFlow = useCallback(
    async (minutes: number) => {
      setSelectedMinutes(minutes);

      // Em desenvolvimento o pagamento é dispensado: passa direto.
      if (PAYMENT_BYPASS) {
        grantAccess(minutes);
        return;
      }

      setStep("pay");
      setLoading(true);
      setError(null);
      setOrder(null);
      setQrDataUrl(null);

      try {
        const amount = priceForMinutes(minutes);
        const created = await createPixCharge({
          durationMinutes: minutes,
          amount,
          description: `Retro Nexus - ${minutes} minutos`,
        });
        setOrder(created);
        setWaiting(true);
      } catch (caught) {
        console.error("Erro ao gerar cobrança PIX:", caught);
        setError(
          "Não foi possível gerar o PIX. Verifique a conexão e tente novamente.",
        );
      } finally {
        setLoading(false);
      }
    },
    [grantAccess, priceForMinutes],
  );

  // Renderiza o QR a partir do copia-e-cola (ou cai no base64 do backend).
  const copiaECola =
    order?.point_of_interaction?.transaction_data?.qr_code ?? "";
  const qrBase64 =
    order?.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;

  useEffect(() => {
    let active = true;
    if (!copiaECola) {
      setQrDataUrl(null);
      return;
    }

    QRCode.toDataURL(copiaECola, { width: 320, margin: 1 })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });

    return () => {
      active = false;
    };
  }, [copiaECola]);

  // Countdown de expiração.
  useEffect(() => {
    if (!order?.date_of_expiration) {
      setTimeLeftMs(null);
      return;
    }
    const expirationMs = new Date(order.date_of_expiration).getTime();
    const tick = () => setTimeLeftMs(Math.max(0, expirationMs - Date.now()));
    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [order]);

  const isExpired = timeLeftMs !== null && timeLeftMs <= 0;

  // Polling do status do pagamento → libera a sessão quando aprovado.
  useEffect(() => {
    if (!order || !waiting || isExpired || PAYMENT_MOCK) return;

    let active = true;
    const intervalId = window.setInterval(async () => {
      try {
        const status = await getPixPaymentStatus(order.id);
        if (!active) return;

        if (isApprovedStatus(status.status)) {
          window.clearInterval(intervalId);
          setWaiting(false);
          if (selectedMinutes != null) grantAccess(selectedMinutes);
        } else if (isFailedStatus(status.status)) {
          window.clearInterval(intervalId);
          setWaiting(false);
          setError("Pagamento recusado ou cancelado. Gere um novo PIX.");
        }
      } catch (caught) {
        // erros transitórios de rede: segue tentando
        console.warn("Falha ao consultar status do PIX:", caught);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [order, waiting, isExpired, selectedMinutes, grantAccess]);

  const resetToChoose = useCallback(() => {
    setStep("choose");
    setOrder(null);
    setQrDataUrl(null);
    setTimeLeftMs(null);
    setWaiting(false);
    setError(null);
    setSelectedMinutes(null);
  }, []);

  const priceForSelected = useMemo(
    () => (selectedMinutes != null ? priceForMinutes(selectedMinutes) : 0),
    [selectedMinutes, priceForMinutes],
  );

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center gap-8 overflow-hidden bg-zinc-950 px-6 text-white">
      <GameCollageBackground />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_60%)]" />

      {PAYMENT_BYPASS ? (
        <div className="absolute right-4 top-4 z-20 rounded-md border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
          MODO DEV · pagamento dispensado
        </div>
      ) : null}

      <div className="z-10 w-full max-w-xl rounded-2xl border border-zinc-700/80 bg-zinc-900/70 p-8 text-center shadow-2xl backdrop-blur-sm">
        <img
          src="/logo.png"
          alt="Retro Nexus"
          className="mx-auto mb-4 h-24 w-24 object-contain drop-shadow-[0_0_24px_rgba(129,140,248,0.45)]"
        />
        <h1 className="text-2xl font-bold">Pagamento</h1>

        {step === "choose" ? (
          <>
            <p className="mt-2 text-sm text-zinc-300">
              Escolha o tempo de uso para liberar a sessão.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {priceOptions.map(({ minutes }) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => void startPaymentFlow(minutes)}
                  className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-4 text-sm font-semibold transition hover:border-emerald-400 hover:bg-emerald-500/10"
                >
                  <div className="text-lg font-bold">{minutes} min</div>
                  <div className="mt-1 text-emerald-300">
                    {formatBRL(priceForMinutes(minutes))}
                  </div>
                </button>
              ))}
            </div>

            {PAYMENT_BYPASS ? (
              <p className="mt-6 text-xs text-amber-200/80">
                Em desenvolvimento, ao escolher o tempo a sessão é liberada sem
                pagamento.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-zinc-300">
              Escaneie o QR Code abaixo para pagar via PIX.
            </p>

            <div className="mt-2 text-3xl font-extrabold text-emerald-300">
              {formatBRL(priceForSelected)}
            </div>
            <div className="text-xs text-zinc-400">
              {selectedMinutes} minutos de jogo
            </div>

            <div className="mx-auto mt-6 flex h-64 w-64 items-center justify-center rounded-xl border border-zinc-600 bg-white p-2">
              {loading ? (
                <span className="text-xs text-zinc-500">Gerando PIX...</span>
              ) : qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code PIX"
                  className="h-full w-full object-contain"
                />
              ) : qrBase64 ? (
                <img
                  src={
                    qrBase64.startsWith("data:image")
                      ? qrBase64
                      : `data:image/png;base64,${qrBase64}`
                  }
                  alt="QR Code PIX"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-xs text-zinc-500">
                  {error ? "Indisponível" : "Aguardando..."}
                </span>
              )}
            </div>

            {timeLeftMs !== null ? (
              <div className="mt-4 text-sm">
                {isExpired ? (
                  <span className="text-red-400">PIX expirado</span>
                ) : (
                  <span className="text-zinc-300">
                    Expira em{" "}
                    <span className="font-semibold text-white">
                      {formatMsToMMSS(timeLeftMs)}
                    </span>
                  </span>
                )}
              </div>
            ) : null}

            {waiting && !isExpired && !error ? (
              <div className="mt-5 flex items-center justify-center gap-2 text-sm text-emerald-300">
                <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
                Aguardando confirmação do pagamento...
              </div>
            ) : null}

            {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

            {/* Em modo mock, permite simular a aprovação para ver o fluxo. */}
            {PAYMENT_MOCK && !error && !isExpired ? (
              <button
                type="button"
                onClick={() =>
                  selectedMinutes != null && grantAccess(selectedMinutes)
                }
                className="mt-5 w-full rounded-lg border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-200"
              >
                MOCK · Simular pagamento aprovado
              </button>
            ) : null}

            {error || isExpired ? (
              <button
                type="button"
                onClick={() =>
                  selectedMinutes != null && void startPaymentFlow(selectedMinutes)
                }
                className="mt-5 w-full rounded-lg border border-emerald-400 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200"
              >
                Gerar novo PIX
              </button>
            ) : null}

            <button
              type="button"
              onClick={resetToChoose}
              className="mt-3 text-xs text-zinc-400 underline"
            >
              Voltar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
