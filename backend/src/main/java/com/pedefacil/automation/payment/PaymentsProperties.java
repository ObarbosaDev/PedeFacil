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
  private Integer mercadopagoRetryMaxAttempts = 3;
  private Integer mercadopagoRetryBaseDelayMs = 250;

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
}
