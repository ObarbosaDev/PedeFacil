import { expect, test } from "@playwright/test";

test("checkout de planos pede autenticacao quando usuario nao entrou", async ({ page }) => {
  await page.goto("/planos/checkout?plano=profissional&billing=monthly");

  await expect(page.getByRole("heading", { name: /primeiro passo: entrar na conta do lojista/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /entrar para pagar/i })).toBeVisible();
});
