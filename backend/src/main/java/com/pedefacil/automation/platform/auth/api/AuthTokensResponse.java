package com.pedefacil.automation.platform.auth.api;

public class AuthTokensResponse {
  private String accessToken;
  private String refreshToken;
  private AuthUserResponse user;
  private String verificationTokenPreview;
  private String resetTokenPreview;

  public String getAccessToken() { return accessToken; }
  public void setAccessToken(String accessToken) { this.accessToken = accessToken; }
  public String getRefreshToken() { return refreshToken; }
  public void setRefreshToken(String refreshToken) { this.refreshToken = refreshToken; }
  public AuthUserResponse getUser() { return user; }
  public void setUser(AuthUserResponse user) { this.user = user; }
  public String getVerificationTokenPreview() { return verificationTokenPreview; }
  public void setVerificationTokenPreview(String verificationTokenPreview) { this.verificationTokenPreview = verificationTokenPreview; }
  public String getResetTokenPreview() { return resetTokenPreview; }
  public void setResetTokenPreview(String resetTokenPreview) { this.resetTokenPreview = resetTokenPreview; }
}
