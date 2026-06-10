/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Porta fixa para o Tauri (devUrl) sempre encontrar o app certo.
  // strictPort evita que o Vite mude de porta silenciosamente e o Tauri
  // acabe carregando outro app rodando na porta padrão.
  server: {
    port: 1420,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Gate de cobertura focado na lógica pura/crítica (testável em node).
      // Componentes/integração com Tauri ficam para testes E2E (Playwright).
      include: [
        "src/features/advertisement/session/sessionTime.ts",
        "src/services/uploadRules.ts",
        "src/services/reconcile.ts",
        "src/services/payment/types.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
});
