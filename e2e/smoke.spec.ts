import { test, expect } from "@playwright/test";

// O app é Tauri: alguns módulos leem window.__TAURI_INTERNALS__ no startup.
// Para o smoke test no navegador, injetamos um stub mínimo do runtime — os
// invokes rejeitam e o app degrada graciosamente (try/catch nos serviços).
// E2E completo do app empacotado exige tauri-driver (WebDriver).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-expect-error stub de runtime para ambiente de teste
    window.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { windowLabel: "main", label: "main" },
      },
      invoke: () => Promise.reject(new Error("no tauri in e2e")),
      transformCallback: (cb: unknown) => cb,
      convertFileSrc: (p: string) => p,
    };
  });
});

test.describe("Totem - shells principais", () => {
  test("tela de pagamento renderiza com opções de tempo", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Pagamento" }),
    ).toBeVisible();
    await expect(page.getByText(/\d+\s*min/).first()).toBeVisible();
  });

  test("painel admin exige senha", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    // Sem banco no e2e, o admin cai no primeiro acesso ("Definir senha"); com
    // senha já cadastrada mostra "Painel administrativo". Aceita os dois.
    await expect(
      page.getByText(/Painel administrativo|Definir senha do admin/),
    ).toBeVisible();
    await expect(page.getByPlaceholder(/senha/i).first()).toBeVisible();
  });
});
