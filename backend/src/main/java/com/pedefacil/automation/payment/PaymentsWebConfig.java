package com.pedefacil.automation.payment;

import java.util.stream.Stream;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class PaymentsWebConfig implements WebMvcConfigurer {

  private final PaymentsProperties properties;

  public PaymentsWebConfig(PaymentsProperties properties) {
    this.properties = properties;
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    String[] origins = Stream.of((properties.getAllowedOrigins() == null ? "" : properties.getAllowedOrigins()).split(","))
        .map(String::trim)
        .filter(StringUtils::hasText)
        .toArray(String[]::new);

    if (origins.length == 0) {
      origins = new String[] {"http://localhost:8080", "http://127.0.0.1:8080"};
    }

    registry.addMapping("/api/payments/**")
        .allowedOrigins(origins)
        .allowedMethods("GET", "POST", "OPTIONS")
        .allowedHeaders("*");
  }
}
