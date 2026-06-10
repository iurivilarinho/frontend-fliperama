import { defineConfig, devices } from "@playwright/test";

// E2E de fumaça no frontend (navegador). As telas dependentes de Tauri/SQLite
// degradam graciosamente fora do runtime nativo; testamos os shells que
// renderizam (pagamento e login do admin). E2E completo do app empacotado
// exige tauri-driver (WebDriver) — próxima fase.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
