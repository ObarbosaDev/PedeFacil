package com.pedefacil.automation;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

@Component
public class SignatureService {

  private static final String HMAC_SHA256 = "HmacSHA256";

  public boolean matches(String secret, String payload, String signatureHeader) {
    if (secret == null || secret.isBlank()) {
      return true;
    }
    if (signatureHeader == null || signatureHeader.isBlank()) {
      return false;
    }

    String expectedHex = computeHex(secret, payload);
    String provided = normalizeSignature(signatureHeader);

    return MessageDigest.isEqual(expectedHex.getBytes(StandardCharsets.UTF_8),
        provided.getBytes(StandardCharsets.UTF_8));
  }

  private String normalizeSignature(String signature) {
    String value = signature.trim().toLowerCase();
    if (value.startsWith("sha256=")) {
      return value.substring("sha256=".length());
    }
    return value;
  }

  private String computeHex(String secret, String payload) {
    try {
      Mac mac = Mac.getInstance(HMAC_SHA256);
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256));
      byte[] digest = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder(digest.length * 2);
      for (byte b : digest) {
        sb.append(String.format("%02x", b));
      }
      return sb.toString();
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to compute HMAC signature", ex);
    }
  }
}

