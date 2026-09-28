package com.pedefacil.automation.platform.auth.service;

import com.pedefacil.automation.platform.auth.model.AppUser;
import com.pedefacil.automation.platform.auth.PlatformAuthProperties;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class LoggingAuthMailDispatcher implements AuthMailDispatcher {
  private final PlatformAuthProperties properties;

  public LoggingAuthMailDispatcher(PlatformAuthProperties properties) {
    this.properties = properties;
  }

  @Override
  public void sendVerificationEmail(AppUser user, String token, String confirmationUrl) {
    requireDevelopmentMode();
  }

  @Override
  public void sendPasswordResetEmail(AppUser user, String token, String resetUrl) {
    requireDevelopmentMode();
  }

  private void requireDevelopmentMode() {
    if (!properties.isDebugExposeTokens()) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Envio de email indisponivel.");
    }
  }
}
