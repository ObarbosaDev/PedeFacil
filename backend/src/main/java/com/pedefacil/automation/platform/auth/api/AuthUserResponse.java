package com.pedefacil.automation.platform.auth.api;

import java.util.UUID;

public class AuthUserResponse {
  private UUID id;
  private String email;
  private String fullName;
  private String role;
  private boolean emailConfirmed;

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
  public String getFullName() { return fullName; }
  public void setFullName(String fullName) { this.fullName = fullName; }
  public String getRole() { return role; }
  public void setRole(String role) { this.role = role; }
  public boolean isEmailConfirmed() { return emailConfirmed; }
  public void setEmailConfirmed(boolean emailConfirmed) { this.emailConfirmed = emailConfirmed; }
}
