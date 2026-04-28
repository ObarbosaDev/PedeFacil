package com.pedefacil.automation.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SupabaseAdminClient {

  private final PaymentsProperties properties;
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;

  public SupabaseAdminClient(PaymentsProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  }

  public StoreSubscriptionRow getSubscriptionByCheckoutSessionId(String checkoutSessionId) {
    String baseUrl = supabaseBaseUrl();
    String select = "checkout_session_id,plan_slug,billing_cycle,amount_cents,currency,status,user_id,payment_method";
    String encodedSession = urlEncode(checkoutSessionId);
    String uri = baseUrl + "/rest/v1/store_subscriptions?select=" + select
        + "&checkout_session_id=eq." + encodedSession + "&limit=1";

    HttpRequest request = baseRequest(URI.create(uri)).GET().build();
    JsonNode array = sendJson(request, "Supabase get store_subscriptions");
    if (!array.isArray() || array.size() == 0) return null;
    JsonNode row = array.get(0);

    return new StoreSubscriptionRow(
        row.path("checkout_session_id").asText(""),
        row.path("plan_slug").asText(""),
        row.path("billing_cycle").asText(""),
        row.path("currency").asText("BRL"),
        row.path("status").asText("pending_payment"),
        row.path("user_id").asText(""),
        row.path("payment_method").asText("pix"),
        row.path("amount_cents").asLong(0L));
  }

  public OrderPaymentSessionRow getOrderPaymentSessionByCheckoutSessionId(String checkoutSessionId) {
    String baseUrl = supabaseBaseUrl();
    String select = "checkout_session_id,order_id,establishment_id,amount_cents,currency,status,payment_method";
    String encodedSession = urlEncode(checkoutSessionId);
    String uri = baseUrl + "/rest/v1/order_payment_sessions?select=" + select
        + "&checkout_session_id=eq." + encodedSession + "&limit=1";

    HttpRequest request = baseRequest(URI.create(uri)).GET().build();
    JsonNode array = sendJson(request, "Supabase get order_payment_sessions");
    if (!array.isArray() || array.size() == 0) return null;
    JsonNode row = array.get(0);

    return new OrderPaymentSessionRow(
        row.path("checkout_session_id").asText(""),
        row.path("order_id").asText(""),
        row.path("establishment_id").asText(""),
        row.path("currency").asText("BRL"),
        row.path("status").asText("pending_payment"),
        row.path("payment_method").asText("pix"),
        row.path("amount_cents").asLong(0L));
  }

  public EstablishmentPaymentConfigRow getEstablishmentPaymentConfigById(String establishmentId) {
    String baseUrl = supabaseBaseUrl();
    String establishmentUri = baseUrl + "/rest/v1/establishments?select=id,name,accepts_marketplace_payments"
        + "&id=eq." + urlEncode(establishmentId) + "&limit=1";
    HttpRequest establishmentRequest = baseRequest(URI.create(establishmentUri)).GET().build();
    JsonNode establishmentArray = sendJson(establishmentRequest, "Supabase get establishments payment config");
    if (!establishmentArray.isArray() || establishmentArray.size() == 0) return null;
    JsonNode establishmentRow = establishmentArray.get(0);

    String accountUri = baseUrl + "/rest/v1/establishment_payment_accounts"
        + "?select=mercadopago_access_token,mercadopago_public_key,mercadopago_user_id"
        + "&establishment_id=eq." + urlEncode(establishmentId) + "&limit=1";
    HttpRequest accountRequest = baseRequest(URI.create(accountUri)).GET().build();
    JsonNode accountArray = sendJson(accountRequest, "Supabase get establishment_payment_accounts");
    JsonNode accountRow = accountArray.isArray() && accountArray.size() > 0 ? accountArray.get(0) : null;

    return new EstablishmentPaymentConfigRow(
        establishmentRow.path("id").asText(""),
        establishmentRow.path("name").asText(""),
        establishmentRow.path("accepts_marketplace_payments").asBoolean(false),
        accountRow == null ? "" : accountRow.path("mercadopago_access_token").asText(""),
        accountRow == null ? "" : accountRow.path("mercadopago_public_key").asText(""),
        accountRow == null ? "" : accountRow.path("mercadopago_user_id").asText(""));
  }

  public void confirmPaymentWebhook(String checkoutSessionId, String providerEventId, String providerName, JsonNode payload) {
    String baseUrl = supabaseBaseUrl();
    String uri = baseUrl + "/rest/v1/rpc/confirm_plan_payment_webhook";

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("p_checkout_session_id", checkoutSessionId);
    body.put("p_provider_event_id", providerEventId);
    body.put("p_provider_name", providerName);
    body.put("p_payload", payload);

    HttpRequest request = baseRequest(URI.create(uri))
        .POST(HttpRequest.BodyPublishers.ofString(writeJson(body)))
        .build();

    sendJson(request, "Supabase confirm_plan_payment_webhook");
  }

  public void revalidatePlanPayment(String checkoutSessionId, String providerEventId, String providerName, JsonNode payload) {
    String baseUrl = supabaseBaseUrl();
    String uri = baseUrl + "/rest/v1/rpc/revalidate_plan_payment";

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("p_checkout_session_id", checkoutSessionId);
    body.put("p_provider_event_id", providerEventId);
    body.put("p_provider_name", providerName);
    body.put("p_payload", payload);

    HttpRequest request = baseRequest(URI.create(uri))
        .POST(HttpRequest.BodyPublishers.ofString(writeJson(body)))
        .build();

    sendJson(request, "Supabase revalidate_plan_payment");
  }

  public void confirmOrderPaymentWebhook(String checkoutSessionId, String providerEventId, String providerName, JsonNode payload) {
    String baseUrl = supabaseBaseUrl();
    String uri = baseUrl + "/rest/v1/rpc/confirm_order_payment_webhook";

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("p_checkout_session_id", checkoutSessionId);
    body.put("p_provider_event_id", providerEventId);
    body.put("p_provider_name", providerName);
    body.put("p_payload", payload);

    HttpRequest request = baseRequest(URI.create(uri))
        .POST(HttpRequest.BodyPublishers.ofString(writeJson(body)))
        .build();

    sendJson(request, "Supabase confirm_order_payment_webhook");
  }

  public void revalidateOrderPayment(String checkoutSessionId, String providerEventId, String providerName, JsonNode payload) {
    String baseUrl = supabaseBaseUrl();
    String uri = baseUrl + "/rest/v1/rpc/revalidate_order_payment";

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("p_checkout_session_id", checkoutSessionId);
    body.put("p_provider_event_id", providerEventId);
    body.put("p_provider_name", providerName);
    body.put("p_payload", payload);

    HttpRequest request = baseRequest(URI.create(uri))
        .POST(HttpRequest.BodyPublishers.ofString(writeJson(body)))
        .build();

    sendJson(request, "Supabase revalidate_order_payment");
  }

  public void upsertPaymentLedger(
      String checkoutSessionId,
      String providerName,
      String providerPaymentId,
      String providerEventId,
      String status,
      Long amountCents,
      String currency,
      JsonNode payload) {
    String baseUrl = supabaseBaseUrl();
    String uri = baseUrl + "/rest/v1/payments_ledger?on_conflict=provider_event_id";

    Map<String, Object> row = new LinkedHashMap<>();
    row.put("checkout_session_id", checkoutSessionId);
    row.put("provider_name", providerName);
    row.put("provider_payment_id", providerPaymentId);
    row.put("provider_event_id", providerEventId);
    row.put("status", status);
    row.put("amount_cents", amountCents);
    row.put("currency", currency);
    row.put("payload", payload == null ? objectMapper.createObjectNode() : payload);

    HttpRequest request = baseRequest(URI.create(uri))
        .header("Prefer", "resolution=merge-duplicates,return=minimal")
        .POST(HttpRequest.BodyPublishers.ofString(writeJson(row)))
        .build();

    sendWithoutBody(request, "Supabase upsert payments_ledger");
  }

  public int rolloverExpiredTrialsToPendingPayment(int limit) {
    String baseUrl = supabaseBaseUrl();
    String uri = baseUrl + "/rest/v1/rpc/rollover_expired_trials_to_pending_payment";

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("p_limit", limit);

    HttpRequest request = baseRequest(URI.create(uri))
        .POST(HttpRequest.BodyPublishers.ofString(writeJson(body)))
        .build();

    JsonNode response = sendJson(request, "Supabase rollover_expired_trials_to_pending_payment");
    if (!response.isArray() || response.size() == 0) return 0;
    return response.get(0).path("processed_count").asInt(0);
  }

  public int expireOverdueActiveSubscriptions(int limit) {
    String baseUrl = supabaseBaseUrl();
    String uri = baseUrl + "/rest/v1/rpc/expire_overdue_active_subscriptions";

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("p_limit", limit);

    HttpRequest request = baseRequest(URI.create(uri))
        .POST(HttpRequest.BodyPublishers.ofString(writeJson(body)))
        .build();

    JsonNode response = sendJson(request, "Supabase expire_overdue_active_subscriptions");
    if (!response.isArray() || response.size() == 0) return 0;
    return response.get(0).path("processed_count").asInt(0);
  }

  public int expireStalePendingSubscriptions(int limit, int maxPendingMinutes) {
    String baseUrl = supabaseBaseUrl();
    String uri = baseUrl + "/rest/v1/rpc/expire_stale_pending_subscriptions";

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("p_limit", limit);
    body.put("p_max_pending_minutes", maxPendingMinutes);

    HttpRequest request = baseRequest(URI.create(uri))
        .POST(HttpRequest.BodyPublishers.ofString(writeJson(body)))
        .build();

    JsonNode response = sendJson(request, "Supabase expire_stale_pending_subscriptions");
    if (!response.isArray() || response.size() == 0) return 0;
    return response.get(0).path("processed_count").asInt(0);
  }

  public OpsReconciliationSnapshot getOpsSubscriptionReconciliationSnapshot(int lookbackHours) {
    String baseUrl = supabaseBaseUrl();
    String uri = baseUrl + "/rest/v1/rpc/ops_subscription_reconciliation_snapshot";

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("p_lookback_hours", lookbackHours);

    HttpRequest request = baseRequest(URI.create(uri))
        .POST(HttpRequest.BodyPublishers.ofString(writeJson(body)))
        .build();

    JsonNode response = sendJson(request, "Supabase ops_subscription_reconciliation_snapshot");
    if (!response.isArray() || response.size() == 0) {
      return new OpsReconciliationSnapshot(0, 0, 0, 0, 0);
    }

    JsonNode row = response.get(0);
    return new OpsReconciliationSnapshot(
        row.path("pending_over_2h").asInt(0),
        row.path("active_expired_count").asInt(0),
        row.path("trial_expired_still_active").asInt(0),
        row.path("approved_payments_lookback").asInt(0),
        row.path("failed_payments_lookback").asInt(0));
  }

  public RateLimitResult enforceRateLimit(String actionKey, String subjectKey, int maxHits, int windowSeconds) {
    String baseUrl = supabaseBaseUrl();
    String uri = baseUrl + "/rest/v1/rpc/enforce_rate_limit";

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("p_action_key", actionKey);
    body.put("p_subject_key", subjectKey);
    body.put("p_max_hits", maxHits);
    body.put("p_window_seconds", windowSeconds);

    HttpRequest request = baseRequest(URI.create(uri))
        .POST(HttpRequest.BodyPublishers.ofString(writeJson(body)))
        .build();

    JsonNode response = sendJson(request, "Supabase enforce_rate_limit");
    if (!response.isArray() || response.size() == 0) {
      return new RateLimitResult(true, 0, 0);
    }

    JsonNode row = response.get(0);
    return new RateLimitResult(
        row.path("allowed").asBoolean(true),
        row.path("current_hits").asInt(0),
        row.path("retry_after_seconds").asInt(0));
  }

  private HttpRequest.Builder baseRequest(URI uri) {
    String serviceRole = required(properties.getSupabaseServiceRoleKey(), "SUPABASE_SERVICE_ROLE_KEY");
    return HttpRequest.newBuilder(uri)
        .timeout(Duration.ofSeconds(20))
        .header("Content-Type", "application/json")
        .header("apikey", serviceRole)
        .header("Authorization", "Bearer " + serviceRole);
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

  private void sendWithoutBody(HttpRequest request, String operation) {
    try {
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      int statusCode = response.statusCode();
      if (statusCode < 200 || statusCode >= 300) {
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
            operation + " falhou. Status: " + statusCode + " Body: " + response.body());
      }
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
          "Falha ao serializar requisicao do Supabase", ex);
    }
  }

  private String supabaseBaseUrl() {
    String raw = required(properties.getSupabaseUrl(), "SUPABASE_URL");
    String normalized = raw.trim();
    if (normalized.endsWith("/")) return normalized.substring(0, normalized.length() - 1);
    return normalized;
  }

  private String urlEncode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }

  private String required(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
          "Configuracao obrigatoria ausente: " + field);
    }
    return value;
  }

  public static class StoreSubscriptionRow {
    private final String checkoutSessionId;
    private final String planSlug;
    private final String billingCycle;
    private final String currency;
    private final String status;
    private final String userId;
    private final String paymentMethod;
    private final long amountCents;

    public StoreSubscriptionRow(
        String checkoutSessionId,
        String planSlug,
        String billingCycle,
        String currency,
        String status,
        String userId,
        String paymentMethod,
        long amountCents) {
      this.checkoutSessionId = checkoutSessionId;
      this.planSlug = planSlug;
      this.billingCycle = billingCycle;
      this.currency = currency;
      this.status = status;
      this.userId = userId;
      this.paymentMethod = paymentMethod;
      this.amountCents = amountCents;
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

    public String getCurrency() {
      return currency;
    }

    public String getStatus() {
      return status;
    }

    public String getUserId() {
      return userId;
    }

    public String getPaymentMethod() {
      return paymentMethod;
    }

    public long getAmountCents() {
      return amountCents;
    }
  }

  public static class OrderPaymentSessionRow {
    private final String checkoutSessionId;
    private final String orderId;
    private final String establishmentId;
    private final String currency;
    private final String status;
    private final String paymentMethod;
    private final long amountCents;

    public OrderPaymentSessionRow(
        String checkoutSessionId,
        String orderId,
        String establishmentId,
        String currency,
        String status,
        String paymentMethod,
        long amountCents) {
      this.checkoutSessionId = checkoutSessionId;
      this.orderId = orderId;
      this.establishmentId = establishmentId;
      this.currency = currency;
      this.status = status;
      this.paymentMethod = paymentMethod;
      this.amountCents = amountCents;
    }

    public String getCheckoutSessionId() {
      return checkoutSessionId;
    }

    public String getOrderId() {
      return orderId;
    }

    public String getEstablishmentId() {
      return establishmentId;
    }

    public String getCurrency() {
      return currency;
    }

    public String getStatus() {
      return status;
    }

    public String getPaymentMethod() {
      return paymentMethod;
    }

    public long getAmountCents() {
      return amountCents;
    }
  }

  public static class EstablishmentPaymentConfigRow {
    private final String id;
    private final String name;
    private final boolean acceptsMarketplacePayments;
    private final String mercadoPagoAccessToken;
    private final String mercadoPagoPublicKey;
    private final String mercadoPagoUserId;

    public EstablishmentPaymentConfigRow(
        String id,
        String name,
        boolean acceptsMarketplacePayments,
        String mercadoPagoAccessToken,
        String mercadoPagoPublicKey,
        String mercadoPagoUserId) {
      this.id = id;
      this.name = name;
      this.acceptsMarketplacePayments = acceptsMarketplacePayments;
      this.mercadoPagoAccessToken = mercadoPagoAccessToken;
      this.mercadoPagoPublicKey = mercadoPagoPublicKey;
      this.mercadoPagoUserId = mercadoPagoUserId;
    }

    public String getId() {
      return id;
    }

    public String getName() {
      return name;
    }

    public boolean isAcceptsMarketplacePayments() {
      return acceptsMarketplacePayments;
    }

    public String getMercadoPagoAccessToken() {
      return mercadoPagoAccessToken;
    }

    public String getMercadoPagoPublicKey() {
      return mercadoPagoPublicKey;
    }

    public String getMercadoPagoUserId() {
      return mercadoPagoUserId;
    }
  }

  public static class OpsReconciliationSnapshot {
    private final int pendingOver2h;
    private final int activeExpiredCount;
    private final int trialExpiredStillActive;
    private final int approvedPaymentsLookback;
    private final int failedPaymentsLookback;

    public OpsReconciliationSnapshot(
        int pendingOver2h,
        int activeExpiredCount,
        int trialExpiredStillActive,
        int approvedPaymentsLookback,
        int failedPaymentsLookback) {
      this.pendingOver2h = pendingOver2h;
      this.activeExpiredCount = activeExpiredCount;
      this.trialExpiredStillActive = trialExpiredStillActive;
      this.approvedPaymentsLookback = approvedPaymentsLookback;
      this.failedPaymentsLookback = failedPaymentsLookback;
    }

    public int getPendingOver2h() {
      return pendingOver2h;
    }

    public int getActiveExpiredCount() {
      return activeExpiredCount;
    }

    public int getTrialExpiredStillActive() {
      return trialExpiredStillActive;
    }

    public int getApprovedPaymentsLookback() {
      return approvedPaymentsLookback;
    }

    public int getFailedPaymentsLookback() {
      return failedPaymentsLookback;
    }
  }

  public static class RateLimitResult {
    private final boolean allowed;
    private final int currentHits;
    private final int retryAfterSeconds;

    public RateLimitResult(boolean allowed, int currentHits, int retryAfterSeconds) {
      this.allowed = allowed;
      this.currentHits = currentHits;
      this.retryAfterSeconds = retryAfterSeconds;
    }

    public boolean isAllowed() {
      return allowed;
    }

    public int getCurrentHits() {
      return currentHits;
    }

    public int getRetryAfterSeconds() {
      return retryAfterSeconds;
    }
  }
}
