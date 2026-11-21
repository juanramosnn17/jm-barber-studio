import { expect, test } from "@playwright/test";

/*
 * Smoke test E2E de producción (tarea 4.16).
 * Confirma que el despliegue quedó funcionando: API viva, portada con catálogo,
 * formulario de login y protección de rutas privadas.
 * Solo lectura: no inicia sesión ni crea datos.
 */
const API_URL = process.env.E2E_API_URL ?? "https://jm-barber-api.onrender.com";

test.describe.configure({ mode: "serial" });

test("la API Spring Boot responde el health check", async ({ request }) => {
  // Despierta Render Free (puede tardar ~60 s) antes de probar las pantallas.
  await expect
    .poll(
      async () => {
        try {
          const res = await request.get(`${API_URL}/api/v1/health`, { timeout: 30_000 });
          return res.status();
        } catch {
          return 0;
        }
      },
      { timeout: 110_000, intervals: [2_000, 5_000, 10_000] },
    )
    .toBe(200);
});

test("la API devuelve el catálogo de servicios", async ({ request }) => {
  const res = await request.get(`${API_URL}/api/v1/services`);
  expect(res.status()).toBe(200);
  const services = (await res.json()) as Array<{ name: string }>;
  expect(services.length).toBeGreaterThan(0);
});

test("la portada carga el catálogo de servicios", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Catálogo Exclusivo" })).toBeVisible();
  await expect(page.getByText("Corte de cabello").first()).toBeVisible();
});

test("/login muestra el formulario de inicio de sesión", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar Sesión" })).toBeVisible();
  await expect(page.locator("#identifier")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
});

test("/admin sin sesión redirige al login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?return_url=%2Fadmin/);
  await expect(page.getByRole("heading", { name: "Iniciar Sesión" })).toBeVisible();
});
