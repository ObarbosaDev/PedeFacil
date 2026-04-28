package com.pedefacil.automation.platform.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "platform.auth")
public class PlatformAuthProperties {

  private String appBaseUrl = "http://localhost:5173";
  private String jwtSecret;
  private int accessTokenMinutes = 30;
  private int refreshTokenDays = 30;
  private int emailVerificationTokenHours = 24;
  private int passwordResetTokenMinutes = 30;
  private boolean debugExposeTokens = false;

  public String getAppBaseUrl() {
    return appBaseUrl;
  }

  public void setAppBaseUrl(String appBaseUrl) {
    this.appBaseUrl = appBaseUrl;
  }

  public String getJwtSecret() {
    return jwtSecret;
  }

  public void setJwtSecret(String jwtSecret) {
    this.jwtSecret = jwtSecret;
  }

  public int getAccessTokenMinutes() {
    return accessTokenMinutes;
  }

  public void setAccessTokenMinutes(int accessTokenMinutes) {
    this.accessTokenMinutes = accessTokenMinutes;
  }

  public int getRefreshTokenDays() {
    return refreshTokenDays;
  }

  public void setRefreshTokenDays(int refreshTokenDays) {
    this.refreshTokenDays = refreshTokenDays;
  }

  public int getEmailVerificationTokenHours() {
    return emailVerificationTokenHours;
  }

  public void setEmailVerificationTokenHours(int emailVerificationTokenHours) {
    this.emailVerificationTokenHours = emailVerificationTokenHours;
  }

  public int getPasswordResetTokenMinutes() {
    return passwordResetTokenMinutes;
  }

  public void setPasswordResetTokenMinutes(int passwordResetTokenMinutes) {
    this.passwordResetTokenMinutes = passwordResetTokenMinutes;
  }

  public boolean isDebugExposeTokens() {
    return debugExposeTokens;
  }

  public void setDebugExposeTokens(boolean debugExposeTokens) {
    this.debugExposeTokens = debugExposeTokens;
  }
}
