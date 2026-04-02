package com.pedefacil.automation.payment;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class PaymentsExceptionHandler {

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException ex) {
    HttpStatus status = ex.getStatus();
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("ok", false);
    body.put("status", status.value());
    body.put("error", status.getReasonPhrase());
    body.put("message", ex.getReason() != null ? ex.getReason() : "Erro de pagamento.");
    body.put("timestamp", OffsetDateTime.now().toString());
    return ResponseEntity.status(status).body(body);
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, Object>> handleAny(Exception ex) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("ok", false);
    body.put("status", 500);
    body.put("error", "Internal Server Error");
    body.put("message", "Erro inesperado ao processar o pagamento.");
    body.put("timestamp", OffsetDateTime.now().toString());
    return ResponseEntity.status(500).body(body);
  }
}
