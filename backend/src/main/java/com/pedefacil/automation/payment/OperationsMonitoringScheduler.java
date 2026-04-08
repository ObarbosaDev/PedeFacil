package com.pedefacil.automation.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class OperationsMonitoringScheduler {
  private static final Logger log = LoggerFactory.getLogger(OperationsMonitoringScheduler.class);

  private final PaymentsProperties properties;
  private final SupabaseAdminClient supabaseAdminClient;
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;
  private final AtomicLong lastAlertEpochMs = new AtomicLong(0L);

  public OperationsMonitoringScheduler(
      PaymentsProperties properties,
      SupabaseAdminClient supabaseAdminClient,
      ObjectMapper objectMapper) {
    this.properties = properties;
    this.supabaseAdminClient = supabaseAdminClient;
    this.objectMapper = objectMapper;
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  }

  @Scheduled(cron = "${payments.ops-monitoring-cron:0 * * * * *}")
  public void monitorHealth() {
    if (!properties.isOpsMonitoringEnabled()) return;

    String baseUrl = properties.getApiPublicBaseUrl();
    if (!StringUtils.hasText(baseUrl)) {
      sendAlertWithCooldown("PAYMENTS_API_PUBLIC_BASE_URL ausente para monitoramento.");
      return;
    }

    String normalized = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    String healthUrl = normalized + "/api/payments/health";
    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(healthUrl))
          .timeout(Duration.ofSeconds(8))
          .GET()
          .build();
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        sendAlertWithCooldown("Health check falhou. Status=" + response.statusCode());
      }
    } catch (Exception ex) {
      sendAlertWithCooldown("Health check com erro: " + ex.getMessage());
    }
  }

  @Scheduled(cron = "${payments.ops-reconciliation-cron:0 0 6 * * *}")
  public void runDailyReconciliation() {
    if (!properties.isOpsMonitoringEnabled()) return;

    int lookback = safePositive(properties.getOpsReconciliationLookbackHours(), 24);
    SupabaseAdminClient.OpsReconciliationSnapshot snapshot =
        supabaseAdminClient.getOpsSubscriptionReconciliationSnapshot(lookback);

    log.info(
        "Reconciliation snapshot {}h => pending_over_2h={}, active_expired={}, trial_expired_still_active={}, approved_payments={}, failed_payments={}",
        lookback,
        snapshot.getPendingOver2h(),
        snapshot.getActiveExpiredCount(),
        snapshot.getTrialExpiredStillActive(),
        snapshot.getApprovedPaymentsLookback(),
        snapshot.getFailedPaymentsLookback());

    boolean hasAnomaly =
        snapshot.getPendingOver2h() > 0
            || snapshot.getActiveExpiredCount() > 0
            || snapshot.getTrialExpiredStillActive() > 0;
    if (hasAnomaly) {
      sendAlertWithCooldown(
          "Reconciliacao detectou pendencias: pending_over_2h="
              + snapshot.getPendingOver2h()
              + ", active_expired="
              + snapshot.getActiveExpiredCount()
              + ", trial_expired_still_active="
              + snapshot.getTrialExpiredStillActive());
    }
  }

  private void sendAlertWithCooldown(String message) {
    log.error("OPS ALERT: {}", message);

    String webhookUrl = properties.getOpsAlertWebhookUrl();
    if (!StringUtils.hasText(webhookUrl)) return;

    long now = Instant.now().toEpochMilli();
    long cooldownMs = safePositive(properties.getOpsAlertCooldownMinutes(), 15) * 60_000L;
    long last = lastAlertEpochMs.get();
    if (last > 0 && now - last < cooldownMs) return;

    if (!lastAlertEpochMs.compareAndSet(last, now)) return;

    try {
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("service", "payments-api");
      payload.put("alert", message);
      payload.put("timestamp", Instant.now().toString());

      HttpRequest request = HttpRequest.newBuilder(URI.create(webhookUrl.trim()))
          .timeout(Duration.ofSeconds(8))
          .header("Content-Type", "application/json")
          .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
          .build();
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        log.warn("Falha ao enviar alerta de operacao para webhook. Status={}", response.statusCode());
      }
    } catch (IOException | InterruptedException ex) {
      if (ex instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      log.warn("Falha ao enviar alerta de operacao para webhook: {}", ex.getMessage());
    }
  }

  private int safePositive(Integer value, int fallback) {
    if (value == null || value <= 0) return fallback;
    return value;
  }
}

