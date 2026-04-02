package com.pedefacil.automation.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/payments")
public class PlanPaymentsController {

  private static final String PROVIDER_NAME = "mercado_pago";

  private final PaymentsProperties properties;
  private final SupabaseAdminClient supabaseAdminClient;
  private final MercadoPagoClient mercadoPagoClient;
  private final ObjectMapper objectMapper;

  public PlanPaymentsController(
      PaymentsProperties properties,
      SupabaseAdminClient supabaseAdminClient,
      MercadoPagoClient mercadoPagoClient,
      ObjectMapper objectMapper) {
    this.properties = properties;
    this.supabaseAdminClient = supabaseAdminClient;
    this.mercadoPagoClient = mercadoPagoClient;
    this.objectMapper = objectMapper;
  }

  @PostMapping("/plan/checkout")
  public Map<String, Object> startPlanCheckout(@RequestBody PlanCheckoutRequest request) {
    String checkoutSessionId = requiredSanitizedCheckoutSessionId(request.getCheckoutSessionId());
    SupabaseAdminClient.StoreSubscriptionRow subscription =
        supabaseAdminClient.getSubscriptionByCheckoutSessionId(checkoutSessionId);

    if (subscription == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Checkout session nao encontrada.");
    }

    if ("active".equalsIgnoreCase(subscription.getStatus())) {
      Map<String, Object> activeResponse = new LinkedHashMap<>();
      activeResponse.put("provider", PROVIDER_NAME);
      activeResponse.put("already_active", true);
      activeResponse.put("checkout_url", null);
      activeResponse.put("preference_id", null);
      activeResponse.put("checkout_session_id", subscription.getCheckoutSessionId());
      return activeResponse;
    }

    String successUrl = requiredUrl(request.getSuccessUrl(), "successUrl");
    String pendingUrl = requiredUrl(request.getPendingUrl(), "pendingUrl");
    String failureUrl = requiredUrl(request.getFailureUrl(), "failureUrl");

    String webhookUrl = buildWebhookUrl();
    BigDecimal amountReais = BigDecimal.valueOf(subscription.getAmountCents())
        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

    MercadoPagoClient.PreferenceResponse preference = mercadoPagoClient.createPreference(
        new MercadoPagoClient.CreatePreferenceInput(
            subscription.getCheckoutSessionId(),
            subscription.getPlanSlug(),
            subscription.getBillingCycle(),
            amountReais,
            webhookUrl,
            successUrl,
            pendingUrl,
            failureUrl));

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("provider", PROVIDER_NAME);
    response.put("already_active", false);
    response.put("checkout_url", preference.getCheckoutUrl());
    response.put("preference_id", preference.getPreferenceId());
    response.put("checkout_session_id", subscription.getCheckoutSessionId());
    return response;
  }

  @PostMapping("/mercadopago/webhook")
  public ResponseEntity<Map<String, Object>> mercadoPagoWebhook(
      @RequestParam Map<String, String> queryParams,
      @RequestBody(required = false) String rawBody) {

    validateWebhookToken(queryParams.get("token"));
    String paymentId = extractPaymentId(queryParams, rawBody);

    if (!StringUtils.hasText(paymentId)) {
      return ResponseEntity.ok(response("ok", true, "processed", false));
    }

    MercadoPagoClient.PaymentInfo payment = mercadoPagoClient.getPayment(paymentId);
    String checkoutSessionId = StringUtils.hasText(payment.getExternalReference())
        ? payment.getExternalReference()
        : "unknown_" + payment.getId();
    String providerEventId = "mp_payment_" + payment.getId();

    supabaseAdminClient.upsertPaymentLedger(
        checkoutSessionId,
        PROVIDER_NAME,
        payment.getId(),
        providerEventId,
        payment.getStatus(),
        null,
        "BRL",
        payment.getRawPayload());

    if (!"approved".equalsIgnoreCase(payment.getStatus())) {
      return ResponseEntity.ok(response(
          "ok", true,
          "processed", false,
          "status", payment.getStatus(),
          "payment_id", payment.getId()));
    }

    if (!StringUtils.hasText(checkoutSessionId)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Pagamento aprovado sem external_reference.");
    }

    supabaseAdminClient.confirmPaymentWebhook(
        checkoutSessionId.trim(),
        providerEventId,
        PROVIDER_NAME,
        payment.getRawPayload());

    return ResponseEntity.ok(response(
        "ok", true,
        "processed", true,
        "payment_id", payment.getId(),
        "checkout_session_id", checkoutSessionId));
  }

  @PostMapping("/plan/revalidate")
  public Map<String, Object> revalidatePlanPayment(@RequestBody RevalidateRequest request) {
    String checkoutSessionId = requiredSanitizedCheckoutSessionId(request.getCheckoutSessionId());
    SupabaseAdminClient.StoreSubscriptionRow subscription =
        supabaseAdminClient.getSubscriptionByCheckoutSessionId(checkoutSessionId);

    if (subscription == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Checkout session nao encontrada.");
    }

    if ("active".equalsIgnoreCase(subscription.getStatus())) {
      return response(
          "ok", true,
          "status", subscription.getStatus(),
          "checkout_session_id", subscription.getCheckoutSessionId(),
          "revalidated", false);
    }

    if (!StringUtils.hasText(request.getPaymentId())) {
      return response(
          "ok", true,
          "status", subscription.getStatus(),
          "checkout_session_id", subscription.getCheckoutSessionId(),
          "revalidated", false,
          "message", "Pagamento ainda nao identificado.");
    }

    MercadoPagoClient.PaymentInfo payment = mercadoPagoClient.getPayment(request.getPaymentId().trim());
    String providerEventId = "mp_manual_revalidate_" + payment.getId();

    supabaseAdminClient.upsertPaymentLedger(
        checkoutSessionId,
        PROVIDER_NAME,
        payment.getId(),
        providerEventId,
        payment.getStatus(),
        null,
        "BRL",
        payment.getRawPayload());

    if ("approved".equalsIgnoreCase(payment.getStatus())) {
      supabaseAdminClient.revalidatePlanPayment(
          checkoutSessionId,
          providerEventId,
          "mercado_pago_manual",
          payment.getRawPayload());
    }

    SupabaseAdminClient.StoreSubscriptionRow refreshed =
        supabaseAdminClient.getSubscriptionByCheckoutSessionId(checkoutSessionId);

    return response(
        "ok", true,
        "status", refreshed == null ? subscription.getStatus() : refreshed.getStatus(),
        "checkout_session_id", checkoutSessionId,
        "payment_status", payment.getStatus(),
        "revalidated", "approved".equalsIgnoreCase(payment.getStatus()));
  }

  private String buildWebhookUrl() {
    String base = properties.getApiPublicBaseUrl();
    if (!StringUtils.hasText(base)) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
          "Configuracao obrigatoria ausente: PAYMENTS_API_PUBLIC_BASE_URL");
    }

    String normalized = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    String lower = normalized.toLowerCase();
    if (lower.contains("localhost") || lower.contains("127.0.0.1")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "PAYMENTS_API_PUBLIC_BASE_URL esta local. Use URL publica HTTPS (ex.: ngrok) para o webhook do Mercado Pago.");
    }

    try {
      URI uri = URI.create(normalized);
      if (!"https".equalsIgnoreCase(uri.getScheme())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "PAYMENTS_API_PUBLIC_BASE_URL precisa ser HTTPS para webhook do Mercado Pago.");
      }
    } catch (IllegalArgumentException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "PAYMENTS_API_PUBLIC_BASE_URL invalida.");
    }
    String token = properties.getMercadopagoWebhookToken();
    if (!StringUtils.hasText(token)) {
      return normalized + "/api/payments/mercadopago/webhook";
    }
    return normalized + "/api/payments/mercadopago/webhook?token=" + token.trim();
  }

  private void validateWebhookToken(String tokenParam) {
    String expected = properties.getMercadopagoWebhookToken();
    if (!StringUtils.hasText(expected)) {
      return;
    }

    if (!expected.trim().equals(tokenParam)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Webhook token invalido.");
    }
  }

  private String extractPaymentId(Map<String, String> queryParams, String rawBody) {
    String fromQuery = firstNotBlank(
        queryParams.get("data.id"),
        queryParams.get("id"),
        queryParams.get("resource_id"));
    if (StringUtils.hasText(fromQuery)) return fromQuery.trim();

    if (!StringUtils.hasText(rawBody)) return null;
    try {
      JsonNode node = objectMapper.readTree(rawBody);
      String fromBody = firstNotBlank(
          asText(node.at("/data/id")),
          asText(node.at("/id")),
          asText(node.at("/resource/id")));
      if (StringUtils.hasText(fromBody)) return fromBody.trim();
      String resource = asText(node.get("resource"));
      if (StringUtils.hasText(resource)) {
        try {
          URI uri = URI.create(resource);
          String path = uri.getPath();
          if (StringUtils.hasText(path) && path.contains("/")) {
            return path.substring(path.lastIndexOf('/') + 1);
          }
        } catch (IllegalArgumentException ignored) {
          return null;
        }
      }
      return null;
    } catch (IOException ex) {
      return null;
    }
  }

  private String requiredSanitizedCheckoutSessionId(String raw) {
    if (!StringUtils.hasText(raw)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "checkoutSessionId e obrigatoria.");
    }
    String trimmed = raw.trim();
    String sanitized = trimmed.replaceAll("[^a-zA-Z0-9_-]", "");
    if (!trimmed.equals(sanitized) || sanitized.length() < 8) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "checkoutSessionId invalida.");
    }
    return sanitized;
  }

  private String requiredUrl(String url, String fieldName) {
    if (!StringUtils.hasText(url)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " e obrigatoria.");
    }
    try {
      URI uri = URI.create(url.trim());
      if (!StringUtils.hasText(uri.getScheme()) || !StringUtils.hasText(uri.getHost())) {
        throw new IllegalArgumentException("invalid");
      }
      return uri.toString();
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " invalida.");
    }
  }

  private String firstNotBlank(String... values) {
    return Arrays.stream(values).filter(StringUtils::hasText).findFirst().orElse(null);
  }

  private String asText(JsonNode node) {
    if (node == null || node.isNull() || node.isMissingNode()) return null;
    return node.asText(null);
  }

  private Map<String, Object> response(Object... data) {
    Map<String, Object> result = new LinkedHashMap<>();
    for (int i = 0; i < data.length - 1; i += 2) {
      result.put(String.valueOf(data[i]), data[i + 1]);
    }
    return result;
  }

  public static class PlanCheckoutRequest {
    private String checkoutSessionId;
    private String successUrl;
    private String pendingUrl;
    private String failureUrl;

    public String getCheckoutSessionId() {
      return checkoutSessionId;
    }

    public void setCheckoutSessionId(String checkoutSessionId) {
      this.checkoutSessionId = checkoutSessionId;
    }

    public String getSuccessUrl() {
      return successUrl;
    }

    public void setSuccessUrl(String successUrl) {
      this.successUrl = successUrl;
    }

    public String getPendingUrl() {
      return pendingUrl;
    }

    public void setPendingUrl(String pendingUrl) {
      this.pendingUrl = pendingUrl;
    }

    public String getFailureUrl() {
      return failureUrl;
    }

    public void setFailureUrl(String failureUrl) {
      this.failureUrl = failureUrl;
    }
  }

  public static class RevalidateRequest {
    private String checkoutSessionId;
    private String paymentId;

    public String getCheckoutSessionId() {
      return checkoutSessionId;
    }

    public void setCheckoutSessionId(String checkoutSessionId) {
      this.checkoutSessionId = checkoutSessionId;
    }

    public String getPaymentId() {
      return paymentId;
    }

    public void setPaymentId(String paymentId) {
      this.paymentId = paymentId;
    }
  }
}
