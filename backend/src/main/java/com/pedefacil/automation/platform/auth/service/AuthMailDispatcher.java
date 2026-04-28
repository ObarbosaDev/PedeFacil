package com.pedefacil.automation.platform.auth.service;

import com.pedefacil.automation.platform.auth.model.AppUser;

public interface AuthMailDispatcher {
  void sendVerificationEmail(AppUser user, String token, String confirmationUrl);
  void sendPasswordResetEmail(AppUser user, String token, String resetUrl);
}
