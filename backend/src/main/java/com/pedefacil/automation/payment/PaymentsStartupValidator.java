package com.pedefacil.automation.payment;

import java.net.URI;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class PaymentsStartupValidator {

  public PaymentsStartupValidator(PaymentsProperties properties) {
    if (!properties.isStrictStartupValidation()) {
      return;
    }

    requireText(properties.getSupabaseUrl(), "SUPABASE_URL");
    requireText(properties.getSupabaseServiceRoleKey(), "SUPABASE_SERVICE_ROLE_KEY");
    requireText(properties.getMercadopagoApiBaseUrl(), "MERCADOPAGO_API_BASE_URL");
    requireText(properties.getMercadopagoAccessToken(), "MERCADOPAGO_ACCESS_TOKEN");
    requireText(properties.getApiPublicBaseUrl(), "PAYMENTS_API_PUBLIC_BASE_URL");

    validateHttpsUrl(properties.getSupabaseUrl(), "SUPABASE_URL");
    validateHttpsUrl(properties.getApiPublicBaseUrl(), "PAYMENTS_API_PUBLIC_BASE_URL");
    validateHttpsUrl(properties.getMercadopagoApiBaseUrl(), "MERCADOPAGO_API_BASE_URL");
  }

  private void requireText(String value, String field) {
    if (!StringUtils.hasText(value)) {
      throw new IllegalStateException("Configuracao obrigatoria ausente: " + field);
    }
  }

  private void validateHttpsUrl(String value, String field) {
    try {
      URI uri = URI.create(value.trim());
      if (!"https".equalsIgnoreCase(uri.getScheme()) || !StringUtils.hasText(uri.getHost())) {
        throw new IllegalStateException("Configuracao invalida para " + field + ": precisa ser URL HTTPS valida.");
      }
    } catch (IllegalArgumentException ex) {
      throw new IllegalStateException("Configuracao invalida para " + field + ": URL malformada.");
    }
  }
}

