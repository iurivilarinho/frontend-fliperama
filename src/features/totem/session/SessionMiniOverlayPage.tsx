import { useEffect, useMemo, useState } from "react";
import MiniOverlayController from "../../../components/overlay/MiniOverlayController";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getStoredMiniPlacement } from "../../../components/overlay/MiniOverlaySettings";

const SESSION_STORAGE_KEY = "arcade-play-session";
const MINI_OVERLAY_WIDTH = 120;
const MINI_OVERLAY_HEIGHT = 70;

function formatSeconds(remainingSeconds: number) {
  const minutes = Math.floor(remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function readSessionRemainingSeconds() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return 0;

  try {
    const parsed = JSON.parse(raw) as { remainingSeconds?: number };
    return Math.max(0, Number(parsed.remainingSeconds) || 0);
  } catch {
    return 0;
  }
}

export function SessionMiniOverlayPage() {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    readSessionRemainingSeconds(),
  );

  const placement = useMemo(() => getStoredMiniPlacement(), []);
  const formatted = useMemo(
    () => formatSeconds(remainingSeconds),
    [remainingSeconds],
  );

  useEffect(() => {
    const sync = () => setRemainingSeconds(readSessionRemainingSeconds());

    sync();
    const timer = window.setInterval(sync, 1000);
    window.addEventListener("storage", sync);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const w = getCurrentWindow();

    const repin = () => {
      w.setAlwaysOnTop(true).catch(() => {});
      w.show().catch(() => {});
      w.unminimize().catch(() => {});
    };

    repin();
    const timer = window.setInterval(repin, 1200);
    window.addEventListener("focus", repin);
    document.addEventListener("visibilitychange", repin);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", repin);
      document.removeEventListener("visibilitychange", repin);
    };
  }, []);

  return (
    <div className="mini-root bg-transparent">
      <MiniOverlayController
        showSeconds={24 * 60 * 60}
        intervalMinutes={24 * 60}
        placement={placement}
        width={MINI_OVERLAY_WIDTH}
        height={MINI_OVERLAY_HEIGHT}
        margin={16}
        transparentBody
      >
        {(visible) =>
          visible ? (
            <div className="h-full w-full">
              <div className="flex h-full w-full flex-col justify-center bg-black/70 px-3 py-5 text-right text-zinc-100">
                <div className="text-[11px] font-semibold leading-none">
                  Tempo restante
                </div>
                <div className="mt-1 font-mono text-base leading-none">
                  {formatted}
                </div>
              </div>
            </div>
          ) : null
        }
      </MiniOverlayController>
    </div>
  );
}
