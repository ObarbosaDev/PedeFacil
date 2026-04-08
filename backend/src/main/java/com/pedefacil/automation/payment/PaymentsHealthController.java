package com.pedefacil.automation.payment;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payments")
public class PaymentsHealthController {

  @GetMapping("/health")
  public Map<String, Object> health() {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("ok", true);
    body.put("service", "payments-api");
    body.put("timestamp", OffsetDateTime.now().toString());
    return body;
  }
}

