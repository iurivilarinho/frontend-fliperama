import { useEffect, useState } from "react";

// Imagens de fundo (tema retrô/arcade) em public/bg. Slideshow em tela cheia.
const IMAGES = [
  "/bg/bg1.webp",
  "/bg/bg2.jpg",
  "/bg/bg3.png",
  "/bg/bg4.jpg",
  "/bg/bg5.webp",
  "/bg/bg6.png",
];

const INTERVAL_MS = 7000;

/**
 * Fundo da tela de pagamento: slideshow em TELA CHEIA das imagens de arcade,
 * uma de cada vez com transição suave, e um véu leve só para o card continuar
 * legível.
 */
export function GameCollageBackground() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setIdx((i) => (i + 1) % IMAGES.length),
      INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className={[
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-[1500ms]",
            i === idx ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />
      ))}
      {/* véu leve para legibilidade do card */}
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
}
