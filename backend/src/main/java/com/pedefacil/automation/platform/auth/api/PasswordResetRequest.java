package com.pedefacil.automation.platform.auth.api;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;

public class PasswordResetRequest {
  @Email @NotBlank
  private String email;

  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
}
