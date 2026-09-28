import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
});

test("apresenta o produto e permite percorrer a demonstracao", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Venda direto.*Faça o cliente voltar/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Quero colocar minha loja no ar/ })).toHaveAttribute("href", /wa\.me/);

  await page.getByRole("tab", { name: "Preparação" }).click();
  await expect(page.getByRole("tab", { name: "Preparação" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".demo-detail").getByRole("heading", { name: "Em preparação" })).toBeVisible();
});

test("mantem a navegacao e os botoes dentro da tela no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Preços" })).toBeVisible();
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Preços" }).click();
  await expect(page).toHaveURL(/#precos$/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
