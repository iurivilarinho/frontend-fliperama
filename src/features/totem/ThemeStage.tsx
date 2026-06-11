import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { HyperspinThemeLayer } from "../../types/hyperspinTheme";
import { useHyperspinTheme } from "../../app/provider/HyperspinThemeProvider";
import { ROUTES } from "../../app/routers/routes";

type ThemeStageProps = {
  visible: boolean;
  onExit: (mode?: "toApp" | "toDesktop") => Promise<void>;
  onAspectRatio?: (ratio: number) => void;
};

type ViewportSize = {
  width: number;
  height: number;
};

function buildLayerStyle(layer: HyperspinThemeLayer): React.CSSProperties {
  return {
    position: "absolute",
    left: `${layer.x}px`,
    top: `${layer.y}px`,
    width: layer.width != null ? `${layer.width}px` : undefined,
    height: layer.height != null ? `${layer.height}px` : undefined,
    opacity: layer.opacity,
    zIndex: layer.zIndex,
    display: layer.visible ? "block" : "none",
    pointerEvents: "none",
  };
}

export const ThemeStage = ({
  visible,
  onExit,
  onAspectRatio,
}: ThemeStageProps) => {
  const { theme, loading, error } = useHyperspinTheme();
  const navigate = useNavigate();
  const mountedVideosRef = useRef<HTMLVideoElement[]>([]);
  const [viewport, setViewport] = useState<ViewportSize>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const goBackToPlay = useCallback(async () => {
    await onExit("toApp");
    navigate(ROUTES.homepage);
  }, [navigate, onExit]);

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      if (!isCtrlOrCmd) return;
      if (event.key.toLowerCase() !== "f") return;

      event.preventDefault();
      event.stopPropagation();
      void goBackToPlay();
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, {
        capture: true,
      } as EventListenerOptions);
    };
  }, [goBackToPlay]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await register("Ctrl+F", () => {
          if (!mounted) return;
          void goBackToPlay();
        });
      } catch {
        // ignora
      }
    })();

    return () => {
      mounted = false;
      void unregister("Ctrl+F").catch(() => {});
    };
  }, [goBackToPlay]);

  useEffect(() => {
    if (!visible) {
      for (const video of mountedVideosRef.current) {
        try {
          video.pause();
        } catch {
          //
        }
      }
    }
  }, [visible]);

  useEffect(() => {
    if (!theme) return;
    if (theme.baseWidth <= 0 || theme.baseHeight <= 0) return;

    onAspectRatio?.(theme.baseWidth / theme.baseHeight);
  }, [theme, onAspectRatio]);

  const baseWidth = theme?.baseWidth ?? 1024;
  const baseHeight = theme?.baseHeight ?? 768;

  const scale = useMemo(() => {
    if (baseWidth <= 0 || baseHeight <= 0) return 1;

    return Math.min(viewport.width / baseWidth, viewport.height / baseHeight);
  }, [viewport.width, viewport.height, baseWidth, baseHeight]);

  const renderableLayers = useMemo(() => {
    return (theme?.layers ?? []).filter((layer) => {
      if (!layer.visible) return false;
      if (layer.type === "flash") return false;
      return layer.type === "image" || layer.type === "video";
    });
  }, [theme]);

  if (!visible) return null;
  if (loading) return null;
  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!theme) return null;

  mountedVideosRef.current = [];

  return (
    <div className="w-screen h-screen overflow-hidden bg-black flex items-center justify-center">
      <div
        className="relative"
        style={{
          width: `${baseWidth}px`,
          height: `${baseHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {renderableLayers.map((layer) => {
          if (layer.type === "image") {
            return (
              <img
                key={layer.id}
                src={layer.url}
                alt={layer.name}
                style={buildLayerStyle(layer)}
                draggable={false}
              />
            );
          }

          return (
            <video
              key={layer.id}
              ref={(element) => {
                if (element) {
                  mountedVideosRef.current.push(element);
                }
              }}
              src={layer.url}
              style={buildLayerStyle(layer)}
              playsInline
              autoPlay
              muted
              loop={layer.loop}
              controls={false}
            />
          );
        })}
      </div>
    </div>
  );
};
