package com.pedefacil.automation;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "automation")
public class AutomationProperties {

  private String receiverToken;
  private String signatureSecret;
  private String outboundMode = "log";
  private String outboundUrl;
  private String outboundBearerToken;
  private String evolutionBaseUrl;
  private String evolutionApiKey;
  private String evolutionInstance;
  private String zapiBaseUrl;
  private String zapiInstance;
  private String zapiToken;

  public String getReceiverToken() {
    return receiverToken;
  }

  public void setReceiverToken(String receiverToken) {
    this.receiverToken = receiverToken;
  }

  public String getSignatureSecret() {
    return signatureSecret;
  }

  public void setSignatureSecret(String signatureSecret) {
    this.signatureSecret = signatureSecret;
  }

  public String getOutboundMode() {
    return outboundMode;
  }

  public void setOutboundMode(String outboundMode) {
    this.outboundMode = outboundMode;
  }

  public String getOutboundUrl() {
    return outboundUrl;
  }

  public void setOutboundUrl(String outboundUrl) {
    this.outboundUrl = outboundUrl;
  }

  public String getOutboundBearerToken() {
    return outboundBearerToken;
  }

  public void setOutboundBearerToken(String outboundBearerToken) {
    this.outboundBearerToken = outboundBearerToken;
  }

  public String getEvolutionBaseUrl() {
    return evolutionBaseUrl;
  }

  public void setEvolutionBaseUrl(String evolutionBaseUrl) {
    this.evolutionBaseUrl = evolutionBaseUrl;
  }

  public String getEvolutionApiKey() {
    return evolutionApiKey;
  }

  public void setEvolutionApiKey(String evolutionApiKey) {
    this.evolutionApiKey = evolutionApiKey;
  }

  public String getEvolutionInstance() {
    return evolutionInstance;
  }

  public void setEvolutionInstance(String evolutionInstance) {
    this.evolutionInstance = evolutionInstance;
  }

  public String getZapiBaseUrl() {
    return zapiBaseUrl;
  }

  public void setZapiBaseUrl(String zapiBaseUrl) {
    this.zapiBaseUrl = zapiBaseUrl;
  }

  public String getZapiInstance() {
    return zapiInstance;
  }

  public void setZapiInstance(String zapiInstance) {
    this.zapiInstance = zapiInstance;
  }

  public String getZapiToken() {
    return zapiToken;
  }

  public void setZapiToken(String zapiToken) {
    this.zapiToken = zapiToken;
  }
}

