import { useEffect, useMemo, useRef, useState } from "react";
import { useHyperspinTheme } from "../../app/provider/HyperspinThemeProvider";
import type { HyperspinThemeLayer } from "../../types/hyperspinTheme";

type ViewportSize = {
  width: number;
  height: number;
};

type HyperspinThemePreviewProps = {
  transparentBackground?: boolean;
  className?: string;
};

function useContainerSize(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState<ViewportSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [containerRef]);

  return size;
}

function isArtworkLayer(layer: HyperspinThemeLayer): boolean {
  return layer.name.toLowerCase().startsWith("artwork");
}

function buildLayerStyle(layer: HyperspinThemeLayer): React.CSSProperties {
  const isArtwork = isArtworkLayer(layer);

  return {
    position: "absolute",
    left: `${layer.x}px`,
    top: `${layer.y}px`,
    transform: "translate(-50%, -50%)",
    width: !isArtwork && layer.width != null ? `${layer.width}px` : undefined,
    height: !isArtwork && layer.height != null ? `${layer.height}px` : undefined,
    maxWidth: isArtwork ? "none" : "100%",
    maxHeight: isArtwork ? "none" : "100%",
    opacity: layer.opacity,
    zIndex: layer.zIndex,
    display: layer.visible ? "block" : "none",
    pointerEvents: "none",
    objectFit: "contain",
    objectPosition: "center",
  };
}

export function HyperspinThemePreview({
  transparentBackground = false,
  className = "",
}: HyperspinThemePreviewProps) {
  const { theme, loading, error } = useHyperspinTheme();
  const mountedVideosRef = useRef<HTMLVideoElement[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerSize = useContainerSize(containerRef);

  useEffect(() => {
    return () => {
      for (const video of mountedVideosRef.current) {
        try {
          video.pause();
        } catch {
          //
        }
      }
    };
  }, []);

  const renderableLayers = useMemo(() => {
    return (theme?.layers ?? []).filter((layer) => {
      if (!layer.visible) return false;
      if (layer.type === "flash") return false;
      return layer.type === "image" || layer.type === "video";
    });
  }, [theme]);

  const baseWidth = theme?.baseWidth ?? 1024;
  const baseHeight = theme?.baseHeight ?? 768;

  const scale = useMemo(() => {
    if (containerSize.width <= 0 || containerSize.height <= 0) return 1;
    if (baseWidth <= 0 || baseHeight <= 0) return 1;

    return Math.min(
      containerSize.width / baseWidth,
      containerSize.height / baseHeight,
    );
  }, [containerSize.width, containerSize.height, baseWidth, baseHeight]);

  mountedVideosRef.current = [];

  const baseBackgroundClass = transparentBackground ? "bg-transparent" : "bg-black";

  if (loading) {
    return (
      <div
        className={[
          "flex h-full w-full items-center justify-center text-zinc-400",
          baseBackgroundClass,
          className,
        ].join(" ")}
      >
        Carregando theme...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={[
          "flex h-full w-full items-center justify-center px-6 text-center text-sm text-red-500",
          baseBackgroundClass,
          className,
        ].join(" ")}
      >
        {error}
      </div>
    );
  }

  if (!theme) {
    return (
      <div
        className={[
          "flex h-full w-full items-center justify-center text-zinc-500",
          baseBackgroundClass,
          className,
        ].join(" ")}
      >
        Nenhum theme carregado
      </div>
    );
  }

  if (renderableLayers.length === 0) {
    // Tema vazio (ex.: plataformas adicionadas sem arte de tema): não mostra
    // mensagem por cima da tela — fica transparente.
    if (transparentBackground) return null;
    return (
      <div
        className={[
          "flex h-full w-full items-center justify-center px-6 text-center text-sm text-zinc-400",
          baseBackgroundClass,
          className,
        ].join(" ")}
      >
        Theme carregado, mas sem camadas compatíveis para renderização.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={[
        "relative h-full w-full overflow-hidden",
        baseBackgroundClass,
        className,
      ].join(" ")}
    >
      <div className="flex h-full w-full items-center justify-center">
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
                  onError={(event) => {
                    console.error("Erro ao carregar imagem do theme:", {
                      name: layer.name,
                      url: layer.url,
                      absolutePath: layer.absolutePath,
                      source: layer.source,
                      currentSrc: event.currentTarget.currentSrc,
                    });
                  }}
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
                autoPlay
                muted
                loop={layer.loop}
                playsInline
                controls={false}
                onError={() => {
                  console.error("Erro ao carregar vídeo do theme:", {
                    name: layer.name,
                    url: layer.url,
                    absolutePath: layer.absolutePath,
                    source: layer.source,
                  });
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}