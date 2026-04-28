import { describe, expect, it } from "vitest";
import { getPlanBySlug, getPlanPrice, getPlanYearlySavings, plans } from "@/lib/plans";

describe("plans pricing", () => {
  it("mantem a ordem comercial dos planos", () => {
    expect(plans.map((plan) => plan.slug)).toEqual(["essencial", "profissional", "premium"]);
    expect(plans[0].monthly).toBeLessThan(plans[1].monthly);
    expect(plans[1].monthly).toBeLessThan(plans[2].monthly);
  });

  it("resolve preco mensal e anual corretamente", () => {
    const profissional = getPlanBySlug("profissional");
    expect(profissional).not.toBeNull();
    expect(getPlanPrice(profissional!, "monthly")).toBe(99);
    expect(getPlanPrice(profissional!, "yearly")).toBe(79);
  });

  it("calcula economia anual sem retornar valor negativo", () => {
    const essencial = getPlanBySlug("essencial");
    expect(essencial).not.toBeNull();
    expect(getPlanYearlySavings(essencial!)).toBe(120);
  });
});
