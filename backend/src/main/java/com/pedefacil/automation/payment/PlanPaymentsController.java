package com.pedefacil.automation.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;
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
  public Map<String, Object> startPlanCheckout(
      HttpServletRequest httpRequest,
      @RequestBody PlanCheckoutRequest request) {
    enforceRateLimit(
        "checkout",
        resolveClientKey(httpRequest),
        safePositive(properties.getCheckoutRateLimitMax(), 20),
        safePositive(properties.getCheckoutRateLimitWindowSeconds(), 60));

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
            "plano-" + subscription.getPlanSlug(),
            "Assinatura Pede Facil - " + capitalize(subscription.getPlanSlug()),
            amountReais,
            webhookUrl,
            successUrl,
            pendingUrl,
            failureUrl,
            subscription.getPaymentMethod(),
            Map.of(
                "plan_slug", subscription.getPlanSlug(),
                "billing_cycle", subscription.getBillingCycle()),
            null));

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("provider", PROVIDER_NAME);
    response.put("already_active", false);
    response.put("checkout_url", preference.getCheckoutUrl());
    response.put("preference_id", preference.getPreferenceId());
    response.put("checkout_session_id", subscription.getCheckoutSessionId());
    return response;
  }

  @PostMapping("/order/checkout")
  public Map<String, Object> startOrderCheckout(
      HttpServletRequest httpRequest,
      @RequestBody OrderCheckoutRequest request) {
    enforceRateLimit(
        "checkout",
        resolveClientKey(httpRequest),
        safePositive(properties.getCheckoutRateLimitMax(), 20),
        safePositive(properties.getCheckoutRateLimitWindowSeconds(), 60));

    String checkoutSessionId = requiredSanitizedCheckoutSessionId(request.getCheckoutSessionId());
    SupabaseAdminClient.OrderPaymentSessionRow orderSession =
        supabaseAdminClient.getOrderPaymentSessionByCheckoutSessionId(checkoutSessionId);

    if (orderSession == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Checkout do pedido nao encontrado.");
    }

    if ("paid".equalsIgnoreCase(orderSession.getStatus())) {
      Map<String, Object> paidResponse = new LinkedHashMap<>();
      paidResponse.put("provider", PROVIDER_NAME);
      paidResponse.put("already_paid", true);
      paidResponse.put("checkout_url", null);
      paidResponse.put("preference_id", null);
      paidResponse.put("checkout_session_id", orderSession.getCheckoutSessionId());
      paidResponse.put("order_id", orderSession.getOrderId());
      return paidResponse;
    }

    String successUrl = requiredUrl(request.getSuccessUrl(), "successUrl");
    String pendingUrl = requiredUrl(request.getPendingUrl(), "pendingUrl");
    String failureUrl = requiredUrl(request.getFailureUrl(), "failureUrl");
    String orderAccessToken = resolveOrderAccessToken(orderSession);
    String webhookUrl = buildOrderWebhookUrl(orderSession.getCheckoutSessionId());
    BigDecimal amountReais = BigDecimal.valueOf(orderSession.getAmountCents())
        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

    String orderShortId = orderSession.getOrderId().length() > 8
        ? orderSession.getOrderId().substring(0, 8).toUpperCase()
        : orderSession.getOrderId().toUpperCase();

    MercadoPagoClient.PreferenceResponse preference = mercadoPagoClient.createOrderPreference(
        new MercadoPagoClient.CreatePreferenceInput(
            orderSession.getCheckoutSessionId(),
            "pedido-" + orderShortId,
            "Pedido Pede Facil #" + orderShortId,
            amountReais,
            webhookUrl,
            successUrl,
            pendingUrl,
            failureUrl,
            orderSession.getPaymentMethod(),
            Map.of(
                "order_id", orderSession.getOrderId(),
                "checkout_type", "order"),
            orderAccessToken));

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("provider", PROVIDER_NAME);
    response.put("already_paid", false);
    response.put("checkout_url", preference.getCheckoutUrl());
    response.put("preference_id", preference.getPreferenceId());
    response.put("checkout_session_id", orderSession.getCheckoutSessionId());
    response.put("order_id", orderSession.getOrderId());
    return response;
  }

  @PostMapping("/mercadopago/webhook")
  public ResponseEntity<Map<String, Object>> mercadoPagoWebhook(
      HttpServletRequest httpRequest,
      @RequestParam Map<String, String> queryParams,
      @RequestBody(required = false) String rawBody) {

    enforceRateLimit(
        "webhook",
        resolveClientKey(httpRequest),
        safePositive(properties.getWebhookRateLimitMax(), 300),
        safePositive(properties.getWebhookRateLimitWindowSeconds(), 60));

    validateWebhookToken(queryParams.get("token"));
    String paymentId = extractPaymentId(queryParams, rawBody);
    String checkoutSessionHint = sanitizeCheckoutSessionHint(queryParams.get("checkout_session_id"));

    if (!StringUtils.hasText(paymentId)) {
      return ResponseEntity.ok(response("ok", true, "processed", false));
    }

    SupabaseAdminClient.OrderPaymentSessionRow orderSession =
        StringUtils.hasText(checkoutSessionHint)
            ? supabaseAdminClient.getOrderPaymentSessionByCheckoutSessionId(checkoutSessionHint)
            : null;
    String orderAccessToken = orderSession != null ? resolveOrderAccessToken(orderSession) : null;
    MercadoPagoClient.PaymentInfo payment = mercadoPagoClient.getPayment(paymentId, orderAccessToken);
    String checkoutSessionId = StringUtils.hasText(payment.getExternalReference())
        ? payment.getExternalReference()
        : checkoutSessionHint;
    if (!StringUtils.hasText(checkoutSessionId)) {
      checkoutSessionId = "unknown_" + payment.getId();
    }
    String providerEventId = "mp_payment_" + payment.getId();

    if (orderSession == null && StringUtils.hasText(checkoutSessionId)) {
      orderSession = supabaseAdminClient.getOrderPaymentSessionByCheckoutSessionId(checkoutSessionId.trim());
    }
    SupabaseAdminClient.StoreSubscriptionRow subscription =
        orderSession == null
            ? supabaseAdminClient.getSubscriptionByCheckoutSessionId(checkoutSessionId.trim())
            : null;

    supabaseAdminClient.upsertPaymentLedger(
        checkoutSessionId,
        PROVIDER_NAME,
        payment.getId(),
        providerEventId,
        payment.getStatus(),
        orderSession != null ? orderSession.getAmountCents() : subscription != null ? subscription.getAmountCents() : null,
        orderSession != null ? orderSession.getCurrency() : subscription != null ? subscription.getCurrency() : "BRL",
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

    boolean processed = false;

    if (orderSession != null) {
      supabaseAdminClient.confirmOrderPaymentWebhook(
          checkoutSessionId.trim(),
          providerEventId,
          PROVIDER_NAME,
          payment.getRawPayload());
      processed = true;
    } else if (subscription != null) {
      supabaseAdminClient.confirmPaymentWebhook(
          checkoutSessionId.trim(),
          providerEventId,
          PROVIDER_NAME,
          payment.getRawPayload());
      processed = true;
    }

    return ResponseEntity.ok(response(
        "ok", true,
        "processed", processed,
        "payment_id", payment.getId(),
        "checkout_session_id", checkoutSessionId));
  }

  @PostMapping("/order/revalidate")
  public Map<String, Object> revalidateOrderPayment(
      HttpServletRequest httpRequest,
      @RequestBody RevalidateRequest request) {
    enforceRateLimit(
        "revalidate",
        resolveClientKey(httpRequest),
        safePositive(properties.getRevalidateRateLimitMax(), 30),
        safePositive(properties.getRevalidateRateLimitWindowSeconds(), 60));

    String checkoutSessionId = requiredSanitizedCheckoutSessionId(request.getCheckoutSessionId());
    SupabaseAdminClient.OrderPaymentSessionRow orderSession =
        supabaseAdminClient.getOrderPaymentSessionByCheckoutSessionId(checkoutSessionId);

    if (orderSession == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Checkout do pedido nao encontrado.");
    }

    if ("paid".equalsIgnoreCase(orderSession.getStatus())) {
      return response(
          "ok", true,
          "status", orderSession.getStatus(),
          "checkout_session_id", orderSession.getCheckoutSessionId(),
          "order_id", orderSession.getOrderId(),
          "revalidated", false);
    }

    if (!StringUtils.hasText(request.getPaymentId())) {
      return response(
          "ok", true,
          "status", orderSession.getStatus(),
          "checkout_session_id", orderSession.getCheckoutSessionId(),
          "order_id", orderSession.getOrderId(),
          "revalidated", false,
          "message", "Pagamento ainda nao identificado.");
    }

    String orderAccessToken = resolveOrderAccessToken(orderSession);
    MercadoPagoClient.PaymentInfo payment =
        mercadoPagoClient.getPayment(request.getPaymentId().trim(), orderAccessToken);
    String providerEventId = "mp_manual_order_revalidate_" + payment.getId();

    supabaseAdminClient.upsertPaymentLedger(
        checkoutSessionId,
        PROVIDER_NAME,
        payment.getId(),
        providerEventId,
        payment.getStatus(),
        orderSession.getAmountCents(),
        orderSession.getCurrency(),
        payment.getRawPayload());

    if ("approved".equalsIgnoreCase(payment.getStatus())) {
      supabaseAdminClient.revalidateOrderPayment(
          checkoutSessionId,
          providerEventId,
          "mercado_pago_manual",
          payment.getRawPayload());
    }

    SupabaseAdminClient.OrderPaymentSessionRow refreshed =
        supabaseAdminClient.getOrderPaymentSessionByCheckoutSessionId(checkoutSessionId);

    return response(
        "ok", true,
        "status", refreshed == null ? orderSession.getStatus() : refreshed.getStatus(),
        "checkout_session_id", checkoutSessionId,
        "order_id", orderSession.getOrderId(),
        "payment_status", payment.getStatus(),
        "revalidated", "approved".equalsIgnoreCase(payment.getStatus()));
  }

  @PostMapping("/plan/revalidate")
  public Map<String, Object> revalidatePlanPayment(
      HttpServletRequest httpRequest,
      @RequestBody RevalidateRequest request) {
    enforceRateLimit(
        "revalidate",
        resolveClientKey(httpRequest),
        safePositive(properties.getRevalidateRateLimitMax(), 30),
        safePositive(properties.getRevalidateRateLimitWindowSeconds(), 60));

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
    return normalized + "/api/payments/mercadopago/webhook?token="
        + URLEncoder.encode(token.trim(), StandardCharsets.UTF_8);
  }

  private String buildOrderWebhookUrl(String checkoutSessionId) {
    String base = buildWebhookUrl();
    String separator = base.contains("?") ? "&" : "?";
    return base + separator + "checkout_session_id="
        + URLEncoder.encode(checkoutSessionId, StandardCharsets.UTF_8);
  }

  private String sanitizeCheckoutSessionHint(String raw) {
    if (!StringUtils.hasText(raw)) return null;
    try {
      return requiredSanitizedCheckoutSessionId(raw.trim());
    } catch (ResponseStatusException ignored) {
      return null;
    }
  }

  private String resolveOrderAccessToken(SupabaseAdminClient.OrderPaymentSessionRow orderSession) {
    if (orderSession == null || !StringUtils.hasText(orderSession.getEstablishmentId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Checkout do pedido sem loja vinculada.");
    }
    SupabaseAdminClient.EstablishmentPaymentConfigRow config =
        supabaseAdminClient.getEstablishmentPaymentConfigById(orderSession.getEstablishmentId());
    if (config == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Loja do pedido nao encontrada.");
    }
    if (!config.isAcceptsMarketplacePayments()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Esta loja ainda nao liberou pagamento no app.");
    }
    if (!StringUtils.hasText(config.getMercadoPagoAccessToken())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "A loja ainda nao configurou a conta de recebimento Mercado Pago.");
    }
    return config.getMercadoPagoAccessToken().trim();
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
      String scheme = uri.getScheme().toLowerCase();
      String host = uri.getHost().toLowerCase();
      boolean isLocalhost = host.equals("localhost") || host.equals("127.0.0.1");
      if (!scheme.equals("https") && !isLocalhost) {
        throw new IllegalArgumentException("invalid_scheme");
      }
      return uri.toString();
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " invalida.");
    }
  }

  private String resolveClientKey(HttpServletRequest request) {
    String forwarded = request.getHeader("X-Forwarded-For");
    if (StringUtils.hasText(forwarded)) {
      return forwarded.split(",")[0].trim();
    }
    String realIp = request.getHeader("X-Real-IP");
    if (StringUtils.hasText(realIp)) {
      return realIp.trim();
    }
    return request.getRemoteAddr();
  }

  private void enforceRateLimit(String action, String subject, int maxHits, int windowSeconds) {
    SupabaseAdminClient.RateLimitResult result =
        supabaseAdminClient.enforceRateLimit(action, subject, maxHits, windowSeconds);
    if (!result.isAllowed()) {
      throw new ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS,
          "Muitas tentativas em sequencia. Aguarde "
              + Math.max(result.getRetryAfterSeconds(), 1)
              + "s para tentar novamente.");
    }
  }

  private int safePositive(Integer value, int fallback) {
    if (value == null || value <= 0) return fallback;
    return value;
  }

  private String firstNotBlank(String... values) {
    for (String value : values) {
      if (StringUtils.hasText(value)) return value;
    }
    return null;
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

  private String capitalize(String text) {
    if (!StringUtils.hasText(text)) return "";
    return text.substring(0, 1).toUpperCase() + text.substring(1).toLowerCase();
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

  public static class OrderCheckoutRequest {
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
