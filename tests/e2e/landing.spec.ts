import { expect, test } from "@playwright/test";

test("home carrega com CTA principal e secao de planos", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /delivery com cara de marca grande/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /ver planos/i }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /preço mais atrativo para entrar/i })).toBeVisible();
});

test("pagina de planos mostra trial e faixa de preço nova", async ({ page }) => {
  await page.goto("/planos");

  await expect(page.getByRole("heading", { name: /preço mais afiado, produto mais sólido/i })).toBeVisible();
  await expect(page.getByText("30 dias grátis")).toBeVisible();
  await expect(page.getByText("R$ 99")).toBeVisible();
});
