/**
 * Módulo: regressão end-to-end da landing.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: rota pública `/` e página legada de planos.
 * Finalidade: garantir que a proposta e as ações comerciais permaneçam visíveis.
 * Motivo: a landing é a primeira etapa do funil de aquisição do piloto.
 * Evolução: validar navegação mobile e evento de conversão first-party.
 */
import { expect, test } from "@playwright/test";

test("home comunica venda direta e oferece entrada no piloto", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /venda direto.*faça o cliente voltar/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /quero colocar minha loja no ar/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /assinatura clara.*sem percentual sobre sua venda/i })).toBeVisible();
});

test("página legada de planos continua acessível durante a migração", async ({ page }) => {
  await page.goto("/planos");

  await expect(page.getByText("30 dias grátis").first()).toBeVisible();
  await expect(page.getByText("R$ 99").first()).toBeVisible();
});
