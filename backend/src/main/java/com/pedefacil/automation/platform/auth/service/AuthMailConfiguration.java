package com.pedefacil.automation.platform.auth.service;

import com.pedefacil.automation.platform.auth.PlatformAuthProperties;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;

@Configuration
public class AuthMailConfiguration {
  @Bean
  public AuthMailDispatcher authMailDispatcher(
      ObjectProvider<JavaMailSender> sender,
      PlatformAuthProperties properties,
      @Value("${platform-mail.from:}") String from) {
    JavaMailSender mail = sender.getIfAvailable();
    if (mail != null && from != null && !from.isBlank()) {
      return new SmtpAuthMailDispatcher(mail, from);
    }
    return new LoggingAuthMailDispatcher(properties);
  }
}
