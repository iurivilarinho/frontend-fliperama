import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { HyperspinPlatformTheme } from "../../services/hyperspinPlatformThemesService";
import { PlatformSelectionScreen } from "./PlatformSelectionScreen";
import { HyperspinThemeProvider } from "../../app/provider/HyperspinThemeProvider";
import { usePlaySession } from "./session/PlaySessionContext";
import { PaymentTimeSelectionScreen } from "./PaymentTimeSelectionScreen";

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
        />
      )}
    </HyperspinThemeProvider>
  );
}
