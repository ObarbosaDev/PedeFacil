package com.pedefacil.automation.platform.auth.api;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

public class RegisterRequest {
  @Email @NotBlank
  private String email;
  @NotBlank @Size(min = 8, max = 120)
  private String password;
  @NotBlank @Size(min = 2, max = 120)
  private String fullName;
  @NotBlank
  private String role;

  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
  public String getPassword() { return password; }
  public void setPassword(String password) { this.password = password; }
  public String getFullName() { return fullName; }
  public void setFullName(String fullName) { this.fullName = fullName; }
  public String getRole() { return role; }
  public void setRole(String role) { this.role = role; }
}
