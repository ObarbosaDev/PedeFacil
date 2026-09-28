package com.pedefacil.automation.platform.orders;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pedefacil.automation.platform.orders.OrderQuoteService.Choice;
import com.pedefacil.automation.platform.orders.OrderQuoteService.Line;
import com.pedefacil.automation.platform.orders.OrderQuoteService.Quote;
import com.pedefacil.automation.platform.orders.OrderQuoteService.QuoteInput;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OrderService {
  private final JdbcTemplate jdbc;
  private final OrderQuoteService quotes;
  private final ObjectMapper json;
  private final String trackingSecret;

  public OrderService(JdbcTemplate jdbc, OrderQuoteService quotes, ObjectMapper json,
      @Value("${platform.orders.tracking-secret:}") String trackingSecret) {
    this.jdbc = jdbc;
    this.quotes = quotes;
    this.json = json;
    this.trackingSecret = trackingSecret;
  }

  @Transactional
  public Map<String, Object> create(String slug, String idempotencyKey, OrderInput input) {
    if (idempotencyKey == null || !idempotencyKey.matches("[A-Za-z0-9_-]{16,120}")) {
      bad("Envie uma chave de idempotencia valida.");
    }
    if (trackingSecret == null || trackingSecret.length() < 32) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Criacao de pedidos indisponivel.");
    }
    validateCustomer(input);
    String fingerprint = sha256(toJson(input));
    List<Map<String, Object>> stores = jdbc.queryForList(
        "SELECT id FROM stores WHERE slug = ? AND published_at IS NOT NULL", slug);
    if (stores.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Loja nao encontrada.");
    UUID storeId = (UUID) stores.get(0).get("id");
    String trackingToken = token(storeId + ":" + idempotencyKey);
    String trackingHash = sha256(trackingToken);
    List<Map<String, Object>> prior = jdbc.queryForList(
        "SELECT id, order_number, status, total_cents, request_hash FROM orders "
            + "WHERE store_id = ? AND idempotency_key = ?", storeId, idempotencyKey);
    if (!prior.isEmpty()) {
      if (!fingerprint.equals(prior.get(0).get("request_hash"))) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Chave ja usada para outro pedido.");
      }
      return receipt(prior.get(0), trackingToken);
    }
    Quote quote = quotes.calculate(slug, input);
    lockCoupon(quote);
    UUID customerId = jdbc.queryForObject(
        "INSERT INTO customers (store_id, name, phone) VALUES (?, ?, ?) "
            + "ON CONFLICT (store_id, phone) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW() "
            + "RETURNING id",
        UUID.class, quote.storeId, input.customerName.trim(), input.phone);
    List<Map<String, Object>> inserted = jdbc.queryForList(
        "INSERT INTO orders (store_id, customer_id, idempotency_key, request_hash, tracking_token_hash, "
            + "status, fulfillment_type, scheduled_for, address_snapshot, customer_name_snapshot, "
            + "customer_phone_snapshot, subtotal_cents, discount_cents, delivery_fee_cents, total_cents, "
            + "payment_method) VALUES (?, ?, ?, ?, ?, 'pending_payment', ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?) "
            + "ON CONFLICT (store_id, idempotency_key) DO NOTHING "
            + "RETURNING id, order_number, status, total_cents",
        quote.storeId, customerId, idempotencyKey, fingerprint, trackingHash,
        quote.fulfillmentType, quote.scheduledFor,
        "delivery".equals(quote.fulfillmentType) ? toJson(input.address) : null,
        input.customerName.trim(), input.phone, quote.subtotalCents, quote.discountCents,
        quote.deliveryFeeCents, quote.totalCents, input.paymentMethod);
    if (inserted.isEmpty()) {
      Map<String, Object> existing = jdbc.queryForMap(
          "SELECT id, order_number, status, total_cents, request_hash FROM orders "
              + "WHERE store_id = ? AND idempotency_key = ?", storeId, idempotencyKey);
      if (!fingerprint.equals(existing.get("request_hash"))) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Chave ja usada para outro pedido.");
      }
      return receipt(existing, trackingToken);
    }
    Map<String, Object> order = inserted.get(0);
    UUID orderId = (UUID) order.get("id");
    for (Line line : quote.lines) {
      UUID itemId = jdbc.queryForObject(
          "INSERT INTO order_items (store_id, order_id, product_id, name_snapshot, unit_price_cents, quantity) "
              + "VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
          UUID.class, quote.storeId, orderId, line.productId, line.name, line.basePriceCents, line.quantity);
      for (Choice choice : line.options) {
        jdbc.update("INSERT INTO order_item_options (store_id, order_item_id, option_id, name_snapshot, "
                + "price_delta_cents) VALUES (?, ?, ?, ?, ?)",
            quote.storeId, itemId, choice.optionId, choice.name, choice.priceDeltaCents);
      }
    }
    if (quote.couponId != null) {
      jdbc.update("INSERT INTO coupon_redemptions (store_id, coupon_id, order_id) VALUES (?, ?, ?)",
          quote.storeId, quote.couponId, orderId);
    }
    jdbc.update("INSERT INTO order_status_events (store_id, order_id, next_status) "
        + "VALUES (?, ?, 'pending_payment')", quote.storeId, orderId);
    return receipt(order, trackingToken);
  }

  public Map<String, Object> tracking(String token) {
    if (token == null || !token.matches("[A-Za-z0-9_-]{40,100}")) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido nao encontrado.");
    }
    List<Map<String, Object>> rows = jdbc.queryForList(
        "SELECT order_number, status, fulfillment_type, estimated_minutes, created_at, updated_at "
            + "FROM orders WHERE tracking_token_hash = ?", sha256(token));
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido nao encontrado.");
    return rows.get(0);
  }

  public List<Map<String, Object>> merchantOrders(UUID storeId) {
    return jdbc.queryForList(
        "SELECT id, order_number, status, fulfillment_type, payment_method, payment_status, "
            + "customer_name_snapshot, subtotal_cents, discount_cents, delivery_fee_cents, total_cents, "
            + "estimated_minutes, created_at FROM orders WHERE store_id = ? ORDER BY created_at DESC LIMIT 100",
        storeId);
  }

  @Transactional
  public Map<String, Object> changeStatus(UUID storeId, UUID orderId, UUID actorId, StatusInput input) {
    if (input == null || input.status == null) bad("Informe o status.");
    List<Map<String, Object>> rows = jdbc.queryForList(
        "SELECT status, fulfillment_type FROM orders WHERE store_id = ? AND id = ? FOR UPDATE", storeId, orderId);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido nao encontrado.");
    String current = (String) rows.get(0).get("status");
    String next = input.status;
    boolean pickup = "pickup".equals(rows.get(0).get("fulfillment_type"));
    boolean valid = "received".equals(current)
        && ("confirmed".equals(next) || "cancelled_by_store".equals(next))
        || "confirmed".equals(current) && "in_preparation".equals(next)
        || "in_preparation".equals(current) && "ready".equals(next)
        || "ready".equals(current) && (pickup ? "delivered".equals(next) : "out_for_delivery".equals(next))
        || "out_for_delivery".equals(current)
            && ("delivered".equals(next) || "delivery_failed".equals(next));
    if (!valid) throw new ResponseStatusException(HttpStatus.CONFLICT, "Transicao de pedido invalida.");
    if ("confirmed".equals(next) && (input.estimatedMinutes == null
        || input.estimatedMinutes < 1 || input.estimatedMinutes > 240)) {
      bad("Informe uma previsao entre 1 e 240 minutos.");
    }
    jdbc.update("UPDATE orders SET status = ?, estimated_minutes = COALESCE(?, estimated_minutes), "
            + "updated_at = NOW() WHERE store_id = ? AND id = ?",
        next, input.estimatedMinutes, storeId, orderId);
    jdbc.update("INSERT INTO order_status_events "
            + "(store_id, order_id, previous_status, next_status, actor_user_id) VALUES (?, ?, ?, ?, ?)",
        storeId, orderId, current, next, actorId);
    return jdbc.queryForMap("SELECT id, order_number, status, estimated_minutes, updated_at "
        + "FROM orders WHERE store_id = ? AND id = ?", storeId, orderId);
  }

  private void validateCustomer(OrderInput input) {
    if (input == null || input.customerName == null || input.customerName.trim().length() < 2
        || input.customerName.trim().length() > 120 || input.phone == null
        || !input.phone.matches("[0-9]{10,11}")) bad("Nome ou telefone invalido.");
    if (!"pix".equals(input.paymentMethod) && !"card".equals(input.paymentMethod)) {
      bad("Forma de pagamento invalida.");
    }
    if ("delivery".equals(input.fulfillmentType)) {
      Address address = input.address;
      if (address == null || address.zipCode == null || !address.zipCode.matches("[0-9]{8}")
          || address.street == null || address.street.isBlank()
          || address.number == null || address.number.isBlank()
          || address.neighborhood == null || address.neighborhood.isBlank()) {
        bad("Endereco de entrega incompleto.");
      }
      if (!address.zipCode.equals(input.zipCode)) bad("CEP da entrega diverge do calculo.");
    }
  }

  private void lockCoupon(Quote quote) {
    if (quote.couponId == null) return;
    List<Map<String, Object>> coupons = jdbc.queryForList(
        "SELECT usage_limit FROM coupons WHERE store_id = ? AND id = ? FOR UPDATE",
        quote.storeId, quote.couponId);
    if (coupons.isEmpty()) bad("Cupom invalido.");
    Number limit = (Number) coupons.get(0).get("usage_limit");
    if (limit == null) return;
    Long used = jdbc.queryForObject(
        "SELECT COUNT(*) FROM coupon_redemptions WHERE store_id = ? AND coupon_id = ?",
        Long.class, quote.storeId, quote.couponId);
    if (used != null && used >= limit.longValue()) bad("Cupom esgotado.");
  }

  private Map<String, Object> receipt(Map<String, Object> order, String trackingToken) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("order_number", order.get("order_number"));
    result.put("status", order.get("status"));
    result.put("total_cents", order.get("total_cents"));
    result.put("tracking_token", trackingToken);
    return result;
  }

  private String token(String value) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(trackingSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception exception) {
      throw new IllegalStateException("Falha ao criar link de acompanhamento.", exception);
    }
  }

  private String sha256(String value) {
    try {
      return Base64.getUrlEncoder().withoutPadding().encodeToString(
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 indisponivel.", exception);
    }
  }

  private String toJson(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (JsonProcessingException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dados do pedido invalidos.");
    }
  }

  private void bad(String message) {
    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }

  public static class OrderInput extends QuoteInput {
    public String customerName;
    public String phone;
    public String paymentMethod;
    public Address address;
  }
  public static class Address {
    public String zipCode;
    public String street;
    public String number;
    public String neighborhood;
    public String complement;
    public String reference;
  }
  public static class StatusInput {
    public String status;
    public Integer estimatedMinutes;
  }
}
