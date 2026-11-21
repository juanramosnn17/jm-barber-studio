import { defineConfig, devices } from "@playwright/test";

/*
 * Smoke test E2E (tarea 4.16): se corre DESPUÉS de desplegar, contra la app publicada.
 * Por defecto apunta a producción; se puede cambiar con E2E_BASE_URL y E2E_API_URL.
 * Las pruebas solo leen: nunca crean citas ni usuarios en producción.
 */
export default defineConfig({
  testDir: "./e2e",
  // Render Free tarda hasta ~60 s en despertar: tiempos generosos.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://jm-barber-studio-delta.vercel.app",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
