package com.pedefacil.automation.payment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class PaymentVerificationTest {
  private final ObjectMapper mapper = new ObjectMapper();

  private MercadoPagoClient.PaymentInfo payment(String reference, String amount) throws Exception {
    JsonNode payload = mapper.readTree("{\"currency_id\":\"BRL\",\"transaction_amount\":" + amount + "}");
    return new MercadoPagoClient.PaymentInfo("pay-1", "approved", "accredited", reference, payload);
  }

  @Test
  void acceptsOnlyMatchingSessionAndAmount() throws Exception {
    assertThatCode(() -> PlanPaymentsController.validateApprovedPayment(
        payment("checkout-123", "129.00"), "checkout-123", 12900, "BRL"))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> PlanPaymentsController.validateApprovedPayment(
        payment("checkout-123", "1.00"), "checkout-123", 12900, "BRL"))
        .isInstanceOf(ResponseStatusException.class);
    assertThatThrownBy(() -> PlanPaymentsController.validateApprovedPayment(
        payment("other", "129.00"), "checkout-123", 12900, "BRL"))
        .isInstanceOf(ResponseStatusException.class);
  }
}
