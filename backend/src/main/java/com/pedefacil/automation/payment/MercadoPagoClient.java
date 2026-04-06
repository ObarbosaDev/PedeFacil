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
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class MercadoPagoClient {
  private static final Logger log = LoggerFactory.getLogger(MercadoPagoClient.class);

  private final PaymentsProperties properties;
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;

  public MercadoPagoClient(PaymentsProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  }

  public PreferenceResponse createPreference(CreatePreferenceInput input) {
    String accessToken = resolveAccessToken(input.getAccessTokenOverride());
    String apiBaseUrl = safeBaseUrl(properties.getMercadopagoApiBaseUrl());

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("external_reference", input.getCheckoutSessionId());
    body.put("notification_url", input.getWebhookUrl());

    Map<String, Object> item = new LinkedHashMap<>();
    item.put("id", input.getItemId());
    item.put("title", input.getTitle());
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
    metadata.putAll(input.getMetadata());
    body.put("metadata", metadata);

    if (input.getPaymentMethod() != null) {
      Map<String, Object> paymentMethods = new LinkedHashMap<>();
      if ("pix".equalsIgnoreCase(input.getPaymentMethod())) {
        paymentMethods.put("excluded_payment_types", new Object[] {
            Map.of("id", "credit_card"),
            Map.of("id", "debit_card"),
            Map.of("id", "ticket"),
            Map.of("id", "atm")
        });
      } else if ("card".equalsIgnoreCase(input.getPaymentMethod())) {
        paymentMethods.put("excluded_payment_types", new Object[] {
            Map.of("id", "bank_transfer"),
            Map.of("id", "ticket"),
            Map.of("id", "atm")
        });
      }
      body.put("payment_methods", paymentMethods);
    }

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

  public PreferenceResponse createPlanPreference(CreatePreferenceInput input) {
    return createPreference(input);
  }

  public PreferenceResponse createOrderPreference(CreatePreferenceInput input) {
    return createPreference(input);
  }

  public PaymentInfo getPayment(String paymentId) {
    return getPayment(paymentId, null);
  }

  public PaymentInfo getPayment(String paymentId, String accessTokenOverride) {
    String accessToken = resolveAccessToken(accessTokenOverride);
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
    int maxAttempts = safePositive(properties.getMercadopagoRetryMaxAttempts(), 3);
    int baseDelayMs = safePositive(properties.getMercadopagoRetryBaseDelayMs(), 250);

    for (int attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        int statusCode = response.statusCode();
        if (statusCode >= 200 && statusCode < 300) {
          return objectMapper.readTree(response.body());
        }

        String bodySnippet = response.body() == null ? "" : response.body();
        if (bodySnippet.length() > 220) {
          bodySnippet = bodySnippet.substring(0, 220);
        }
        boolean retryable = isRetryableStatus(statusCode);
        log.warn(
            "{} retornou status {} (tentativa {}/{}). Body resumido: {}",
            operation,
            statusCode,
            attempt,
            maxAttempts,
            bodySnippet);

        if (!retryable || attempt == maxAttempts) {
          throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
              operation + " falhou com o provedor de pagamento. Tente novamente.");
        }

        sleepBackoff(attempt, baseDelayMs);
      } catch (InterruptedException ex) {
        Thread.currentThread().interrupt();
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, operation + " interrompido", ex);
      } catch (IOException ex) {
        if (attempt == maxAttempts) {
          throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, operation + " falhou na comunicacao", ex);
        }
        log.warn("{} com falha de comunicacao (tentativa {}/{}).", operation, attempt, maxAttempts);
        sleepBackoff(attempt, baseDelayMs);
      }
    }
    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
        operation + " falhou com o provedor de pagamento.");
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

  private String resolveAccessToken(String accessTokenOverride) {
    if (StringUtils.hasText(accessTokenOverride)) {
      return accessTokenOverride.trim();
    }
    return required(properties.getMercadopagoAccessToken(), "MERCADOPAGO_ACCESS_TOKEN");
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

  private boolean isRetryableStatus(int statusCode) {
    return statusCode == 408 || statusCode == 429 || statusCode >= 500;
  }

  private void sleepBackoff(int attempt, int baseDelayMs) throws InterruptedException {
    long delay = (long) baseDelayMs * attempt;
    Thread.sleep(Math.min(delay, 2000L));
  }

  private int safePositive(Integer value, int fallback) {
    if (value == null || value <= 0) return fallback;
    return value;
  }

  public static class CreatePreferenceInput {
    private final String checkoutSessionId;
    private final String itemId;
    private final String title;
    private final BigDecimal amountReais;
    private final String webhookUrl;
    private final String successUrl;
    private final String pendingUrl;
    private final String failureUrl;
    private final String paymentMethod;
    private final Map<String, Object> metadata;
    private final String accessTokenOverride;

    public CreatePreferenceInput(
        String checkoutSessionId,
        String itemId,
        String title,
        BigDecimal amountReais,
        String webhookUrl,
        String successUrl,
        String pendingUrl,
        String failureUrl,
        String paymentMethod,
        Map<String, Object> metadata,
        String accessTokenOverride) {
      this.checkoutSessionId = checkoutSessionId;
      this.itemId = itemId;
      this.title = title;
      this.amountReais = amountReais;
      this.webhookUrl = webhookUrl;
      this.successUrl = successUrl;
      this.pendingUrl = pendingUrl;
      this.failureUrl = failureUrl;
      this.paymentMethod = paymentMethod;
      this.metadata = metadata == null ? Map.of() : metadata;
      this.accessTokenOverride = accessTokenOverride;
    }

    public String getCheckoutSessionId() {
      return checkoutSessionId;
    }

    public String getItemId() {
      return itemId;
    }

    public String getTitle() {
      return title;
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

    public String getPaymentMethod() {
      return paymentMethod;
    }

    public Map<String, Object> getMetadata() {
      return metadata;
    }

    public String getAccessTokenOverride() {
      return accessTokenOverride;
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
