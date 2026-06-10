import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppProvider } from "./provider/AppProvider";
import { HyperspinThemeProvider } from "./provider/HyperspinThemeProvider";
import { ThemeProvider } from "./provider/ThemeProviderContext";
import { AppRoutes } from "./routers/AppRoutes";
import { PlaySessionProvider } from "../features/advertisement/session/PlaySessionContext";

export default function App() {
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
