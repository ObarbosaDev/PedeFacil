/**
 * Módulo: contrato do conteúdo comercial.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: landing e oferta do piloto.
 * Finalidade: impedir regressão para três planos ou promessas incompatíveis.
 * Motivo: conteúdo comercial incorreto gera obrigação operacional e jurídica.
 * Evolução: validar também benefícios contra o catálogo de entitlements do backend.
 */
import { describe, expect, it } from "vitest";
import { frequentlyAskedQuestions, pilotPlans, valuePropositions } from "./landing-content";

describe("conteúdo comercial do MVP", () => {
  it("oferece somente os dois planos definidos para o piloto", () => {
    expect(pilotPlans.map((plan) => plan.name)).toEqual(["Direto", "Crescimento"]);
  });

  it("comunica venda, operação e recompra como os três resultados", () => {
    expect(valuePropositions.map((item) => item.eyebrow)).toEqual(["Venda", "Opere", "Cresça"]);
  });

  it("explica que a assinatura não substitui taxas do provedor", () => {
    const commissionAnswer = frequentlyAskedQuestions.find((item) => item.question.includes("comissão"))?.answer;
    expect(commissionAnswer).toContain("Taxas do provedor de pagamento continuam existindo");
  });
});
