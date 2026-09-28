package com.pedefacil.automation.payment;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "payments")
public class PaymentsProperties {
  private String apiPublicBaseUrl;
  private String mercadopagoAccessToken;
  private String mercadopagoApiBaseUrl = "https://api.mercadopago.com";
  private String mercadopagoWebhookSecret;
  private Integer mercadopagoRetryMaxAttempts = 3;
  private Integer mercadopagoRetryBaseDelayMs = 250;

  public String getApiPublicBaseUrl() { return apiPublicBaseUrl; }
  public void setApiPublicBaseUrl(String value) { apiPublicBaseUrl = value; }
  public String getMercadopagoAccessToken() { return mercadopagoAccessToken; }
  public void setMercadopagoAccessToken(String value) { mercadopagoAccessToken = value; }
  public String getMercadopagoApiBaseUrl() { return mercadopagoApiBaseUrl; }
  public void setMercadopagoApiBaseUrl(String value) { mercadopagoApiBaseUrl = value; }
  public String getMercadopagoWebhookSecret() { return mercadopagoWebhookSecret; }
  public void setMercadopagoWebhookSecret(String value) { mercadopagoWebhookSecret = value; }
  public Integer getMercadopagoRetryMaxAttempts() { return mercadopagoRetryMaxAttempts; }
  public void setMercadopagoRetryMaxAttempts(Integer value) { mercadopagoRetryMaxAttempts = value; }
  public Integer getMercadopagoRetryBaseDelayMs() { return mercadopagoRetryBaseDelayMs; }
  public void setMercadopagoRetryBaseDelayMs(Integer value) { mercadopagoRetryBaseDelayMs = value; }
}
