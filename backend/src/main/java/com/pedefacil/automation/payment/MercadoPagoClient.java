package com.pedefacil.automation.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MercadoPagoClient {

  private final PaymentsProperties properties;
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;

  public MercadoPagoClient(PaymentsProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  }

  public PreferenceResponse createPreference(CreatePreferenceInput input) {
    String accessToken = required(properties.getMercadopagoAccessToken(), "MERCADOPAGO_ACCESS_TOKEN");
    String apiBaseUrl = safeBaseUrl(properties.getMercadopagoApiBaseUrl());

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("external_reference", input.getCheckoutSessionId());
    body.put("notification_url", input.getWebhookUrl());

    Map<String, Object> item = new LinkedHashMap<>();
    item.put("id", "plano-" + input.getPlanSlug());
    item.put("title", "Assinatura Pede Facil - " + capitalize(input.getPlanSlug()));
    item.put("quantity", 1);
    item.put("currency_id", "BRL");
    item.put("unit_price", input.getAmountReais());
    body.put("items", new Object[] {item});

    Map<String, String> backUrls = new LinkedHashMap<>();
    backUrls.put("success", input.getSuccessUrl());
    backUrls.put("pending", input.getPendingUrl());
    backUrls.put("failure", input.getFailureUrl());
    body.put("back_urls", backUrls);

    Map<String, Object> metadata = new LinkedHashMap<>();
    metadata.put("checkout_session_id", input.getCheckoutSessionId());
    metadata.put("plan_slug", input.getPlanSlug());
    metadata.put("billing_cycle", input.getBillingCycle());
    body.put("metadata", metadata);

    HttpRequest request = HttpRequest.newBuilder(URI.create(apiBaseUrl + "/checkout/preferences"))
        .timeout(Duration.ofSeconds(20))
        .header("Authorization", "Bearer " + accessToken)
        .header("Content-Type", "application/json")
        .header("X-Idempotency-Key", input.getCheckoutSessionId())
        .POST(HttpRequest.BodyPublishers.ofString(writeJson(body)))
        .build();

    JsonNode response = sendJson(request, "Mercado Pago create preference");
    String preferenceId = text(response, "id");
    String initPoint = text(response, "init_point");

    if (isBlank(preferenceId) || isBlank(initPoint)) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
          "Mercado Pago nao retornou dados suficientes para iniciar checkout.");
    }

    return new PreferenceResponse(preferenceId, initPoint);
  }

  public PaymentInfo getPayment(String paymentId) {
    String accessToken = required(properties.getMercadopagoAccessToken(), "MERCADOPAGO_ACCESS_TOKEN");
    String apiBaseUrl = safeBaseUrl(properties.getMercadopagoApiBaseUrl());

    HttpRequest request = HttpRequest.newBuilder(URI.create(apiBaseUrl + "/v1/payments/" + paymentId))
        .timeout(Duration.ofSeconds(20))
        .header("Authorization", "Bearer " + accessToken)
        .header("Content-Type", "application/json")
        .GET()
        .build();

    JsonNode response = sendJson(request, "Mercado Pago get payment");
    return new PaymentInfo(
        text(response, "id"),
        text(response, "status"),
        text(response, "status_detail"),
        text(response, "external_reference"),
        response);
  }

  private JsonNode sendJson(HttpRequest request, String operation) {
    try {
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      int statusCode = response.statusCode();
      if (statusCode < 200 || statusCode >= 300) {
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
            operation + " falhou. Status: " + statusCode + " Body: " + response.body());
      }
      return objectMapper.readTree(response.body());
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, operation + " interrompido", ex);
    } catch (IOException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, operation + " falhou na comunicacao", ex);
    }
  }

  private String writeJson(Object body) {
    try {
      return objectMapper.writeValueAsString(body);
    } catch (IOException ex) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
          "Falha ao serializar requisicao de pagamento", ex);
    }
  }

  private String text(JsonNode node, String field) {
    JsonNode value = node.get(field);
    if (value == null || value.isNull()) return null;
    return value.asText();
  }

  private String required(String value, String field) {
    if (isBlank(value)) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
          "Configuracao obrigatoria ausente: " + field);
    }
    return value.trim();
  }

  private String safeBaseUrl(String value) {
    String normalized = required(value, "MERCADOPAGO_API_BASE_URL");
    if (normalized.endsWith("/")) return normalized.substring(0, normalized.length() - 1);
    return normalized;
  }

  private String capitalize(String text) {
    if (isBlank(text)) return "";
    return text.substring(0, 1).toUpperCase() + text.substring(1).toLowerCase();
  }

  private boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  public static class CreatePreferenceInput {
    private final String checkoutSessionId;
    private final String planSlug;
    private final String billingCycle;
    private final BigDecimal amountReais;
    private final String webhookUrl;
    private final String successUrl;
    private final String pendingUrl;
    private final String failureUrl;

    public CreatePreferenceInput(
        String checkoutSessionId,
        String planSlug,
        String billingCycle,
        BigDecimal amountReais,
        String webhookUrl,
        String successUrl,
        String pendingUrl,
        String failureUrl) {
      this.checkoutSessionId = checkoutSessionId;
      this.planSlug = planSlug;
      this.billingCycle = billingCycle;
      this.amountReais = amountReais;
      this.webhookUrl = webhookUrl;
      this.successUrl = successUrl;
      this.pendingUrl = pendingUrl;
      this.failureUrl = failureUrl;
    }

    public String getCheckoutSessionId() {
      return checkoutSessionId;
    }

    public String getPlanSlug() {
      return planSlug;
    }

    public String getBillingCycle() {
      return billingCycle;
    }

    public BigDecimal getAmountReais() {
      return amountReais;
    }

    public String getWebhookUrl() {
      return webhookUrl;
    }

    public String getSuccessUrl() {
      return successUrl;
    }

    public String getPendingUrl() {
      return pendingUrl;
    }

    public String getFailureUrl() {
      return failureUrl;
    }
  }

  public static class PreferenceResponse {
    private final String preferenceId;
    private final String checkoutUrl;

    public PreferenceResponse(String preferenceId, String checkoutUrl) {
      this.preferenceId = preferenceId;
      this.checkoutUrl = checkoutUrl;
    }

    public String getPreferenceId() {
      return preferenceId;
    }

    public String getCheckoutUrl() {
      return checkoutUrl;
    }
  }

  public static class PaymentInfo {
    private final String id;
    private final String status;
    private final String statusDetail;
    private final String externalReference;
    private final JsonNode rawPayload;

    public PaymentInfo(
        String id,
        String status,
        String statusDetail,
        String externalReference,
        JsonNode rawPayload) {
      this.id = id;
      this.status = status;
      this.statusDetail = statusDetail;
      this.externalReference = externalReference;
      this.rawPayload = rawPayload;
    }

    public String getId() {
      return id;
    }

    public String getStatus() {
      return status;
    }

    public String getStatusDetail() {
      return statusDetail;
    }

    public String getExternalReference() {
      return externalReference;
    }

    public JsonNode getRawPayload() {
      return rawPayload;
    }
  }
}
