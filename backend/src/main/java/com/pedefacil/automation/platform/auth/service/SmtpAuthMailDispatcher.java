package com.pedefacil.automation.platform.auth.service;

import com.pedefacil.automation.platform.auth.model.AppUser;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

public class SmtpAuthMailDispatcher implements AuthMailDispatcher {
  private final JavaMailSender sender;
  private final String from;

  public SmtpAuthMailDispatcher(JavaMailSender sender, String from) {
    this.sender = sender;
    this.from = from;
  }

  @Override
  public void sendVerificationEmail(AppUser user, String token, String confirmationUrl) {
    send(user.getEmail(), "Confirme seu email no Pede Facil",
        "Ola, " + user.getFullName() + ".\n\nConfirme seu email: " + confirmationUrl
            + "\n\nSe voce nao criou esta conta, ignore esta mensagem.");
  }

  @Override
  public void sendPasswordResetEmail(AppUser user, String token, String resetUrl) {
    send(user.getEmail(), "Redefina sua senha no Pede Facil",
        "Ola, " + user.getFullName() + ".\n\nRedefina sua senha: " + resetUrl
            + "\n\nSe voce nao solicitou, ignore esta mensagem.");
  }

  private void send(String to, String subject, String body) {
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(from);
    message.setTo(to);
    message.setSubject(subject);
    message.setText(body);
    sender.send(message);
  }
}
