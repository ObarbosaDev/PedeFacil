package com.pedefacil.automation.payment;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class SubscriptionLifecycleScheduler {
  private static final Logger log = LoggerFactory.getLogger(SubscriptionLifecycleScheduler.class);

  private final PaymentsProperties properties;
  private final SupabaseAdminClient supabaseAdminClient;

  public SubscriptionLifecycleScheduler(
      PaymentsProperties properties,
      SupabaseAdminClient supabaseAdminClient) {
    this.properties = properties;
    this.supabaseAdminClient = supabaseAdminClient;
  }

  @Scheduled(cron = "${payments.trial-rollover-cron:0 */10 * * * *}")
  public void run() {
    if (!properties.isTrialRolloverEnabled()) {
      return;
    }

    int trialBatch = safePositive(properties.getTrialRolloverBatchSize(), 200);
    int lifecycleBatch = safePositive(properties.getSubscriptionLifecycleBatchSize(), 200);
    int maxPendingMinutes = safePositive(properties.getStalePendingMaxMinutes(), 120);

    int trialProcessed = supabaseAdminClient.rolloverExpiredTrialsToPendingPayment(trialBatch);
    int activeExpired = supabaseAdminClient.expireOverdueActiveSubscriptions(lifecycleBatch);
    int stalePendingExpired =
        supabaseAdminClient.expireStalePendingSubscriptions(lifecycleBatch, maxPendingMinutes);

    if (trialProcessed > 0 || activeExpired > 0 || stalePendingExpired > 0) {
      log.info(
          "Subscription lifecycle job executado: trial->pending={}, active->expired={}, stale_pending->expired={}",
          trialProcessed,
          activeExpired,
          stalePendingExpired);
    }
  }

  private int safePositive(Integer value, int fallback) {
    if (value == null || value <= 0) return fallback;
    return value;
  }
}

