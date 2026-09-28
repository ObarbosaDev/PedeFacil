/**
 * Modulo: testes de autenticacao de webhooks.
 * Data: 2026-09-23.
 * Responsavel: Engenharia Pede Facil.
 * Tela/fluxo: confirmacao assincrona de pagamentos.
 * Finalidade: impedir regressao na montagem e comparacao da assinatura HMAC.
 * Motivo: uma notificacao forjada nunca pode liberar pedido ou assinatura.
 * Evolucao: incluir vetores oficiais adicionais quando o provedor publicar novos formatos.
 */
package com.pedefacil.automation.payment;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MercadoPagoWebhookSignatureValidatorTest {

  private final MercadoPagoWebhookSignatureValidator validator =
      new MercadoPagoWebhookSignatureValidator();

  @Test
  void acceptsValidSignature() {
    boolean valid = validator.isValid(
        "ts=1742505638683,v1=04ee6cdb22970783e25034388ad8a4e61edbbe6fa377105da7f1574b52e4a2e2",
        "4ed4fa2b-0b31-42ec-a62f-ad793c486c59",
        "123456789",
        "pedefacil-test-secret");

    assertThat(valid).isTrue();
  }

  @Test
  void rejectsTamperedDataId() {
    boolean valid = validator.isValid(
        "ts=1742505638683,v1=04ee6cdb22970783e25034388ad8a4e61edbbe6fa377105da7f1574b52e4a2e2",
        "4ed4fa2b-0b31-42ec-a62f-ad793c486c59",
        "987654321",
        "pedefacil-test-secret");

    assertThat(valid).isFalse();
  }

  @Test
  void rejectsMissingSecurityFields() {
    assertThat(validator.isValid(null, "request", "123", "secret")).isFalse();
    assertThat(validator.isValid("ts=1,v1=abc", "request", "123", "secret")).isFalse();
    assertThat(validator.isValid("ts=1,v1=" + "a".repeat(64), "", "123", "secret")).isFalse();
  }
}
