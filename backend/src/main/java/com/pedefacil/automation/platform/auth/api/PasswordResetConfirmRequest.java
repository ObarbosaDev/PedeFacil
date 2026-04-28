package com.pedefacil.automation.platform.auth.api;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

public class PasswordResetConfirmRequest {
  @NotBlank
  private String token;
  @NotBlank @Size(min = 8, max = 120)
  private String newPassword;

  public String getToken() { return token; }
  public void setToken(String token) { this.token = token; }
  public String getNewPassword() { return newPassword; }
  public void setNewPassword(String newPassword) { this.newPassword = newPassword; }
}
