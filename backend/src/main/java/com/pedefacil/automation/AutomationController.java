package com.pedefacil.automation;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping
public class AutomationController {

  private final AutomationProperties properties;
  private final SignatureService signatureService;
  private final OutboundService outboundService;

  public AutomationController(
      AutomationProperties properties,
      SignatureService signatureService,
      OutboundService outboundService) {
    this.properties = properties;
    this.signatureService = signatureService;
    this.outboundService = outboundService;
  }

  @GetMapping("/health")
  public Map<String, Object> health() {
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("status", "ok");
    response.put("service", "pedefacil-whatsapp-receiver-java");
    response.put("timestamp", OffsetDateTime.now().toString());
    return response;
  }

  @PostMapping("/webhook/pedefacil")
  public Map<String, Object> receive(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestHeader(value = "x-pedefacil-signature", required = false) String signature,
      @RequestBody String rawBody) {

    validateToken(authorization);
    validateSignature(rawBody, signature);
    outboundService.dispatch(rawBody);

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("ok", true);
    response.put("mode", properties.getOutboundMode());
    response.put("receivedAt", OffsetDateTime.now().toString());
    return response;
  }

  private void validateToken(String authorization) {
    String expected = properties.getReceiverToken();
    if (!StringUtils.hasText(expected)) {
      return;
    }

    String provided = extractBearerToken(authorization);
    if (!expected.equals(provided)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token de acesso invalido");
    }
  }

  private void validateSignature(String rawBody, String signatureHeader) {
    String secret = properties.getSignatureSecret();
    boolean valid = signatureService.matches(secret, rawBody, signatureHeader);
    if (!valid) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Assinatura invalida");
    }
  }

  private String extractBearerToken(String authorization) {
    if (!StringUtils.hasText(authorization)) {
      return null;
    }
    if (authorization.regionMatches(true, 0, "Bearer ", 0, "Bearer ".length())) {
      return authorization.substring("Bearer ".length()).trim();
    }
    return authorization.trim();
  }
}

