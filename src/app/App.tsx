import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppProvider } from "./provider/AppProvider";
import { HyperspinThemeProvider } from "./provider/HyperspinThemeProvider";
import { ThemeProvider } from "./provider/ThemeProviderContext";
import { AppRoutes } from "./routers/AppRoutes";
import { PlaySessionProvider } from "../features/advertisement/session/PlaySessionContext";
import { useGamepadNavigation } from "../hooks/useGamepadNavigation";
import { applySavedInGameMapping } from "../services/emulatorInput";

export default function App() {
  // Ponte global de controle (PS/Xbox/genérico) -> navegação do totem.
  useGamepadNavigation();

  // Auto-aplica a config de controle salva nos emuladores ao iniciar o totem.
  // Garante que num RetroArch novo/limpo os binds corretos e as travas de
  // atalho (fast-forward, frame advance, etc.) sempre estejam presentes, sem
  // depender do operador clicar em "Aplicar". Só na janela principal.
  useEffect(() => {
    if (window.location.pathname === "/player-mini") return;
    void applySavedInGameMapping().catch((error) => {
      console.warn("Falha ao auto-aplicar config de controle:", error);
    });
  }, []);

  // Rede de segurança: Ctrl+M fecha o app de qualquer tela (inclusive NotFound).
  // O atalho global equivalente é registrado no Rust (funciona até com o
  // emulador em primeiro plano).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "m") {
        event.preventDefault();
        invoke("quit_app").catch((error) => {
          console.error("Erro ao encerrar aplicação:", error);
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, {
        capture: true,
      } as EventListenerOptions);
  }, []);

  return (
    <ThemeProvider defaultTheme="dark">
      <HyperspinThemeProvider>
        <AppProvider>
          <PlaySessionProvider>
            <AppRoutes />
          </PlaySessionProvider>
        </AppProvider>
      </HyperspinThemeProvider>
    </ThemeProvider>
  );
}
