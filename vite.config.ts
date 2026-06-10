import { defineConfig } from "vite";
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
});