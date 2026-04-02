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
    String select = "checkout_session_id,plan_slug,billing_cycle,amount_cents,currency,status,user_id";
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
        row.path("amount_cents").asLong(0L));
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

    sendJson(request, "Supabase upsert payments_ledger");
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
    private final long amountCents;

    public StoreSubscriptionRow(
        String checkoutSessionId,
        String planSlug,
        String billingCycle,
        String currency,
        String status,
        String userId,
        long amountCents) {
      this.checkoutSessionId = checkoutSessionId;
      this.planSlug = planSlug;
      this.billingCycle = billingCycle;
      this.currency = currency;
      this.status = status;
      this.userId = userId;
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

    public long getAmountCents() {
      return amountCents;
    }
  }
}
