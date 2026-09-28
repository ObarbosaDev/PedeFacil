/**
 * Modulo: autenticacao de webhooks do Mercado Pago.
 * Data: 2026-09-23.
 * Responsavel: Engenharia Pede Facil.
 * Tela/fluxo: confirmacao assincrona de pagamentos.
 * Finalidade: rejeitar notificacoes que nao tenham a assinatura oficial do provedor.
 * Motivo: um token em query string nao comprova a origem da requisicao.
 * Evolucao: adicionar janela maxima do timestamp quando o provedor formalizar esse requisito.
 */
package com.pedefacil.automation.payment;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class MercadoPagoWebhookSignatureValidator {

  private static final String HMAC_SHA_256 = "HmacSHA256";

  public boolean isValid(
      String signatureHeader,
      String requestId,
      String dataId,
      String secret) {
    if (!StringUtils.hasText(signatureHeader)
        || !StringUtils.hasText(requestId)
        || !StringUtils.hasText(dataId)
        || !StringUtils.hasText(secret)) {
      return false;
    }

    Map<String, String> signatureParts = parseSignature(signatureHeader);
    String timestamp = signatureParts.get("ts");
    String receivedHash = signatureParts.get("v1");
    if (!StringUtils.hasText(timestamp) || !isLowercaseHexSha256(receivedHash)) {
      return false;
    }

    String normalizedDataId = normalizeDataId(dataId);
    String manifest = "id:" + normalizedDataId
        + ";request-id:" + requestId.trim()
        + ";ts:" + timestamp.trim() + ";";
    String expectedHash = hmacSha256Hex(manifest, secret.trim());

    return MessageDigest.isEqual(
        expectedHash.getBytes(StandardCharsets.US_ASCII),
        receivedHash.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII));
  }

  private Map<String, String> parseSignature(String signatureHeader) {
    Map<String, String> parts = new LinkedHashMap<>();
    for (String rawPart : signatureHeader.split(",")) {
      String[] pair = rawPart.trim().split("=", 2);
      if (pair.length == 2 && StringUtils.hasText(pair[0]) && StringUtils.hasText(pair[1])) {
        parts.put(pair[0].trim().toLowerCase(Locale.ROOT), pair[1].trim());
      }
    }
    return parts;
  }

  private String normalizeDataId(String dataId) {
    String normalized = dataId.trim();
    return normalized.matches("[A-Za-z0-9]+") ? normalized.toLowerCase(Locale.ROOT) : normalized;
  }

  private boolean isLowercaseHexSha256(String value) {
    return StringUtils.hasText(value) && value.matches("(?i)[a-f0-9]{64}");
  }

  private String hmacSha256Hex(String value, String secret) {
    try {
      Mac mac = Mac.getInstance(HMAC_SHA_256);
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA_256));
      byte[] hash = mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder(hash.length * 2);
      for (byte item : hash) {
        hex.append(String.format("%02x", item));
      }
      return hex.toString();
    } catch (Exception exception) {
      throw new IllegalStateException("Nao foi possivel validar a assinatura do webhook.", exception);
    }
  }
}
