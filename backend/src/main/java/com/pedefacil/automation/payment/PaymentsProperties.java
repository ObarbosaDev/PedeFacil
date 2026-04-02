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
}
