package com.pedefacil.automation.platform.auth.service;

import com.pedefacil.automation.platform.auth.model.AppUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class LoggingAuthMailDispatcher implements AuthMailDispatcher {

  private static final Logger log = LoggerFactory.getLogger(LoggingAuthMailDispatcher.class);

  @Override
  public void sendVerificationEmail(AppUser user, String token, String confirmationUrl) {
    log.warn("Email de verificacao nao enviado: configure um provedor de email antes de ativar o novo auth.");
  }

  @Override
  public void sendPasswordResetEmail(AppUser user, String token, String resetUrl) {
    log.warn("Email de redefinicao nao enviado: configure um provedor de email antes de ativar o novo auth.");
  }
}
