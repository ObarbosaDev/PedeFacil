package com.pedefacil.automation.payment;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payments")
public class PaymentsHealthController {

  private final PaymentsProperties properties;

  public PaymentsHealthController(PaymentsProperties properties) {
    this.properties = properties;
  }

  @GetMapping("/health")
  public ResponseEntity<Map<String, Object>> health() {
    Map<String, Object> body = new LinkedHashMap<>();
    boolean configured =
        StringUtils.hasText(properties.getSupabaseUrl())
            && StringUtils.hasText(properties.getSupabaseServiceRoleKey())
            && StringUtils.hasText(properties.getApiPublicBaseUrl())
            && StringUtils.hasText(properties.getMercadopagoApiBaseUrl());

    body.put("ok", configured);
    body.put("service", "payments-api");
    body.put("configured", configured);
    body.put("timestamp", OffsetDateTime.now().toString());
    return ResponseEntity.status(configured ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
  }
}
