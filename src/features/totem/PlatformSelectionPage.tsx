import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { HyperspinPlatformTheme } from "../../services/hyperspinPlatformThemesService";
import { PlatformSelectionScreen } from "./PlatformSelectionScreen";
import { HyperspinThemeProvider } from "../../app/provider/HyperspinThemeProvider";
import { usePlaySession } from "./session/PlaySessionContext";
import { PaymentTimeSelectionScreen } from "./PaymentTimeSelectionScreen";
import { AttractMode } from "./AttractMode";
import { useIdle } from "../../hooks/useIdle";
import { useTotemCursor } from "../../hooks/useTotemCursor";

const ATTRACT_IDLE_MS = 45000;

export function PlatformSelectionPage() {
  const navigate = useNavigate();
  const {
    durationOptionsMinutes,
    canPlay,
    startSession,
    status,
    resetSession,
  } = usePlaySession();

  useEffect(() => {
    if (status !== "expired") return;
    resetSession();
  }, [resetSession, status]);

  // Cursor do totem: estilizado no controle de PC, escondido nos demais.
  useTotemCursor();

  // Enquanto o QR do PIX está aberto, o modo atrair fica desligado para não
  // cobrir o cliente no meio do pagamento.
  const [pixQrOpen, setPixQrOpen] = useState(false);

  // Modo atrair: após 45s ocioso na tela inicial, roda vídeos pra chamar cliente.
  const [idle, resetIdle] = useIdle(ATTRACT_IDLE_MS, !pixQrOpen);

  const handleSelectPlatform = useCallback(
    async (platform: HyperspinPlatformTheme) => {
      navigate("/games", {
        state: {
          platform,
        },
      });
    },
    [navigate],
  );

  return (
    <HyperspinThemeProvider>
      {canPlay ? (
        <PlatformSelectionScreen onSelectPlatform={handleSelectPlatform} />
      ) : (
        <PaymentTimeSelectionScreen
          durationOptionsMinutes={durationOptionsMinutes}
          onSelectDuration={startSession}
          onPaymentStepChange={setPixQrOpen}
        />
      )}
      {idle ? <AttractMode onExit={resetIdle} /> : null}
    </HyperspinThemeProvider>
  );
}
