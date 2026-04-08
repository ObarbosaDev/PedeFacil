package com.pedefacil.automation.payment;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "payments")
public class PaymentsProperties {

  private String apiPublicBaseUrl;
  private String allowedOrigins;
  private String mercadopagoAccessToken;
  private String mercadopagoApiBaseUrl = "https://api.mercadopago.com";
  private String mercadopagoWebhookToken;
  private String supabaseUrl;
  private String supabaseServiceRoleKey;
  private Integer checkoutRateLimitMax = 20;
  private Integer checkoutRateLimitWindowSeconds = 60;
  private Integer revalidateRateLimitMax = 30;
  private Integer revalidateRateLimitWindowSeconds = 60;
  private Integer webhookRateLimitMax = 300;
  private Integer webhookRateLimitWindowSeconds = 60;
  private Integer mercadopagoRetryMaxAttempts = 3;
  private Integer mercadopagoRetryBaseDelayMs = 250;
  private boolean trialRolloverEnabled = true;
  private String trialRolloverCron = "0 */10 * * * *";
  private Integer trialRolloverBatchSize = 200;
  private Integer subscriptionLifecycleBatchSize = 200;
  private Integer stalePendingMaxMinutes = 120;
  private boolean strictStartupValidation = true;
  private boolean opsMonitoringEnabled = true;
  private String opsMonitoringCron = "0 * * * * *";
  private String opsReconciliationCron = "0 0 6 * * *";
  private Integer opsReconciliationLookbackHours = 24;
  private String opsAlertWebhookUrl;
  private Integer opsAlertCooldownMinutes = 15;

  public String getApiPublicBaseUrl() {
    return apiPublicBaseUrl;
  }

  public void setApiPublicBaseUrl(String apiPublicBaseUrl) {
    this.apiPublicBaseUrl = apiPublicBaseUrl;
  }

  public String getAllowedOrigins() {
    return allowedOrigins;
  }

  public void setAllowedOrigins(String allowedOrigins) {
    this.allowedOrigins = allowedOrigins;
  }

  public String getMercadopagoAccessToken() {
    return mercadopagoAccessToken;
  }

  public void setMercadopagoAccessToken(String mercadopagoAccessToken) {
    this.mercadopagoAccessToken = mercadopagoAccessToken;
  }

  public String getMercadopagoApiBaseUrl() {
    return mercadopagoApiBaseUrl;
  }

  public void setMercadopagoApiBaseUrl(String mercadopagoApiBaseUrl) {
    this.mercadopagoApiBaseUrl = mercadopagoApiBaseUrl;
  }

  public String getMercadopagoWebhookToken() {
    return mercadopagoWebhookToken;
  }

  public void setMercadopagoWebhookToken(String mercadopagoWebhookToken) {
    this.mercadopagoWebhookToken = mercadopagoWebhookToken;
  }

  public String getSupabaseUrl() {
    return supabaseUrl;
  }

  public void setSupabaseUrl(String supabaseUrl) {
    this.supabaseUrl = supabaseUrl;
  }

  public String getSupabaseServiceRoleKey() {
    return supabaseServiceRoleKey;
  }

  public void setSupabaseServiceRoleKey(String supabaseServiceRoleKey) {
    this.supabaseServiceRoleKey = supabaseServiceRoleKey;
  }

  public Integer getCheckoutRateLimitMax() {
    return checkoutRateLimitMax;
  }

  public void setCheckoutRateLimitMax(Integer checkoutRateLimitMax) {
    this.checkoutRateLimitMax = checkoutRateLimitMax;
  }

  public Integer getCheckoutRateLimitWindowSeconds() {
    return checkoutRateLimitWindowSeconds;
  }

  public void setCheckoutRateLimitWindowSeconds(Integer checkoutRateLimitWindowSeconds) {
    this.checkoutRateLimitWindowSeconds = checkoutRateLimitWindowSeconds;
  }

  public Integer getRevalidateRateLimitMax() {
    return revalidateRateLimitMax;
  }

  public void setRevalidateRateLimitMax(Integer revalidateRateLimitMax) {
    this.revalidateRateLimitMax = revalidateRateLimitMax;
  }

  public Integer getRevalidateRateLimitWindowSeconds() {
    return revalidateRateLimitWindowSeconds;
  }

  public void setRevalidateRateLimitWindowSeconds(Integer revalidateRateLimitWindowSeconds) {
    this.revalidateRateLimitWindowSeconds = revalidateRateLimitWindowSeconds;
  }

  public Integer getWebhookRateLimitMax() {
    return webhookRateLimitMax;
  }

  public void setWebhookRateLimitMax(Integer webhookRateLimitMax) {
    this.webhookRateLimitMax = webhookRateLimitMax;
  }

  public Integer getWebhookRateLimitWindowSeconds() {
    return webhookRateLimitWindowSeconds;
  }

  public void setWebhookRateLimitWindowSeconds(Integer webhookRateLimitWindowSeconds) {
    this.webhookRateLimitWindowSeconds = webhookRateLimitWindowSeconds;
  }

  public Integer getMercadopagoRetryMaxAttempts() {
    return mercadopagoRetryMaxAttempts;
  }

  public void setMercadopagoRetryMaxAttempts(Integer mercadopagoRetryMaxAttempts) {
    this.mercadopagoRetryMaxAttempts = mercadopagoRetryMaxAttempts;
  }

  public Integer getMercadopagoRetryBaseDelayMs() {
    return mercadopagoRetryBaseDelayMs;
  }

  public void setMercadopagoRetryBaseDelayMs(Integer mercadopagoRetryBaseDelayMs) {
    this.mercadopagoRetryBaseDelayMs = mercadopagoRetryBaseDelayMs;
  }

  public boolean isTrialRolloverEnabled() {
    return trialRolloverEnabled;
  }

  public void setTrialRolloverEnabled(boolean trialRolloverEnabled) {
    this.trialRolloverEnabled = trialRolloverEnabled;
  }

  public String getTrialRolloverCron() {
    return trialRolloverCron;
  }

  public void setTrialRolloverCron(String trialRolloverCron) {
    this.trialRolloverCron = trialRolloverCron;
  }

  public Integer getTrialRolloverBatchSize() {
    return trialRolloverBatchSize;
  }

  public void setTrialRolloverBatchSize(Integer trialRolloverBatchSize) {
    this.trialRolloverBatchSize = trialRolloverBatchSize;
  }

  public Integer getSubscriptionLifecycleBatchSize() {
    return subscriptionLifecycleBatchSize;
  }

  public void setSubscriptionLifecycleBatchSize(Integer subscriptionLifecycleBatchSize) {
    this.subscriptionLifecycleBatchSize = subscriptionLifecycleBatchSize;
  }

  public Integer getStalePendingMaxMinutes() {
    return stalePendingMaxMinutes;
  }

  public void setStalePendingMaxMinutes(Integer stalePendingMaxMinutes) {
    this.stalePendingMaxMinutes = stalePendingMaxMinutes;
  }

  public boolean isStrictStartupValidation() {
    return strictStartupValidation;
  }

  public void setStrictStartupValidation(boolean strictStartupValidation) {
    this.strictStartupValidation = strictStartupValidation;
  }

  public boolean isOpsMonitoringEnabled() {
    return opsMonitoringEnabled;
  }

  public void setOpsMonitoringEnabled(boolean opsMonitoringEnabled) {
    this.opsMonitoringEnabled = opsMonitoringEnabled;
  }

  public String getOpsMonitoringCron() {
    return opsMonitoringCron;
  }

  public void setOpsMonitoringCron(String opsMonitoringCron) {
    this.opsMonitoringCron = opsMonitoringCron;
  }

  public String getOpsReconciliationCron() {
    return opsReconciliationCron;
  }

  public void setOpsReconciliationCron(String opsReconciliationCron) {
    this.opsReconciliationCron = opsReconciliationCron;
  }

  public Integer getOpsReconciliationLookbackHours() {
    return opsReconciliationLookbackHours;
  }

  public void setOpsReconciliationLookbackHours(Integer opsReconciliationLookbackHours) {
    this.opsReconciliationLookbackHours = opsReconciliationLookbackHours;
  }

  public String getOpsAlertWebhookUrl() {
    return opsAlertWebhookUrl;
  }

  public void setOpsAlertWebhookUrl(String opsAlertWebhookUrl) {
    this.opsAlertWebhookUrl = opsAlertWebhookUrl;
  }

  public Integer getOpsAlertCooldownMinutes() {
    return opsAlertCooldownMinutes;
  }

  public void setOpsAlertCooldownMinutes(Integer opsAlertCooldownMinutes) {
    this.opsAlertCooldownMinutes = opsAlertCooldownMinutes;
  }
}
