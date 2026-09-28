package com.pedefacil.automation.platform.orders;

import java.sql.Time;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OrderQuoteService {
  private final JdbcTemplate jdbc;

  public OrderQuoteService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public Quote calculate(String slug, QuoteInput input) {
    if (input == null || input.items == null || input.items.isEmpty() || input.items.size() > 50) {
      bad("Carrinho invalido.");
    }
    List<Map<String, Object>> stores = jdbc.queryForList(
        "SELECT id, slug, operation_status, accepts_preorders, delivery_enabled, pickup_enabled, timezone "
            + "FROM stores WHERE slug = ? AND published_at IS NOT NULL", slug);
    if (stores.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Loja nao encontrada.");
    Map<String, Object> store = stores.get(0);
    UUID storeId = (UUID) store.get("id");
    if (!"delivery".equals(input.fulfillmentType) && !"pickup".equals(input.fulfillmentType)) {
      bad("Escolha entrega ou retirada.");
    }
    if ("delivery".equals(input.fulfillmentType) && !Boolean.TRUE.equals(store.get("delivery_enabled"))
        || "pickup".equals(input.fulfillmentType) && !Boolean.TRUE.equals(store.get("pickup_enabled"))) {
      bad("Modalidade indisponivel.");
    }
    validateSchedule(store, input.scheduledFor);

    Quote quote = new Quote();
    quote.storeId = storeId;
    quote.fulfillmentType = input.fulfillmentType;
    quote.scheduledFor = input.scheduledFor;
    Set<UUID> productsSeen = new HashSet<>();
    for (ItemInput selected : input.items) {
      if (selected == null || selected.productId == null || selected.quantity < 1 || selected.quantity > 50
          || !productsSeen.add(selected.productId)) bad("Item do carrinho invalido.");
      Map<String, Object> product = single(
          "SELECT id, name, price_cents FROM products WHERE store_id = ? AND id = ? "
              + "AND available = TRUE AND archived_at IS NULL",
          storeId, selected.productId);
      if (product == null) bad("Produto indisponivel.");
      Line line = new Line();
      line.productId = selected.productId;
      line.name = (String) product.get("name");
      line.unitPriceCents = ((Number) product.get("price_cents")).longValue();
      line.basePriceCents = line.unitPriceCents;
      line.quantity = selected.quantity;
      Set<UUID> selectedOptions = new HashSet<>();
      if (selected.optionIds != null) {
        for (UUID optionId : selected.optionIds) {
          if (optionId == null || !selectedOptions.add(optionId)) bad("Adicional repetido ou invalido.");
        }
      }
      List<Map<String, Object>> groups = jdbc.queryForList(
          "SELECT id, name, min_select, max_select FROM product_option_groups "
              + "WHERE store_id = ? AND product_id = ?", storeId, selected.productId);
      for (Map<String, Object> group : groups) {
        UUID groupId = (UUID) group.get("id");
        List<Map<String, Object>> options = jdbc.queryForList(
            "SELECT id, name, price_delta_cents, available FROM product_options "
                + "WHERE store_id = ? AND group_id = ?", storeId, groupId);
        int count = 0;
        for (Map<String, Object> option : options) {
          UUID optionId = (UUID) option.get("id");
          if (!selectedOptions.remove(optionId)) continue;
          if (!Boolean.TRUE.equals(option.get("available"))) bad("Adicional indisponivel.");
          count++;
          Choice choice = new Choice();
          choice.optionId = optionId;
          choice.name = (String) option.get("name");
          choice.priceDeltaCents = ((Number) option.get("price_delta_cents")).longValue();
          line.options.add(choice);
          line.unitPriceCents = Math.addExact(line.unitPriceCents, choice.priceDeltaCents);
        }
        if (count < ((Number) group.get("min_select")).intValue()
            || count > ((Number) group.get("max_select")).intValue()) {
          bad("Confira as escolhas de " + group.get("name") + ".");
        }
      }
      if (!selectedOptions.isEmpty()) bad("Adicional nao pertence ao produto.");
      quote.lines.add(line);
      quote.subtotalCents = Math.addExact(quote.subtotalCents,
          Math.multiplyExact(line.unitPriceCents, line.quantity));
    }
    if ("delivery".equals(input.fulfillmentType)) {
      quote.deliveryFeeCents = deliveryFee(storeId, input.zipCode, quote.subtotalCents);
    }
    if (input.couponCode != null && !input.couponCode.isBlank()) {
      applyCoupon(quote, input.couponCode.trim().toUpperCase(java.util.Locale.ROOT));
    }
    quote.totalCents = Math.addExact(
        Math.subtractExact(quote.subtotalCents, quote.discountCents), quote.deliveryFeeCents);
    return quote;
  }

  private long deliveryFee(UUID storeId, String zipCode, long subtotalCents) {
    if (zipCode == null || !zipCode.matches("[0-9]{8}")) bad("Informe um CEP valido para entrega.");
    List<Map<String, Object>> zones = jdbc.queryForList(
        "SELECT fee_cents, minimum_order_cents, free_over_cents FROM delivery_zones "
            + "WHERE store_id = ? AND active = TRUE AND ? LIKE zip_prefix || '%' "
            + "ORDER BY length(zip_prefix) DESC LIMIT 1", storeId, zipCode);
    if (zones.isEmpty()) bad("Entrega indisponivel para este CEP.");
    Map<String, Object> zone = zones.get(0);
    if (subtotalCents < ((Number) zone.get("minimum_order_cents")).longValue()) {
      bad("Pedido abaixo do minimo para este CEP.");
    }
    Number freeOver = (Number) zone.get("free_over_cents");
    return freeOver != null && subtotalCents >= freeOver.longValue()
        ? 0 : ((Number) zone.get("fee_cents")).longValue();
  }

  private void applyCoupon(Quote quote, String code) {
    List<Map<String, Object>> matches = jdbc.queryForList(
        "SELECT id, discount_type, discount_value, minimum_order_cents, maximum_discount_cents "
            + "FROM coupons WHERE store_id = ? AND upper(code) = ? AND active = TRUE "
            + "AND (starts_at IS NULL OR starts_at <= NOW()) AND (expires_at IS NULL OR expires_at > NOW()) "
            + "AND (usage_limit IS NULL OR usage_limit > "
            + "(SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = coupons.id))",
        quote.storeId, code);
    if (matches.isEmpty()) bad("Cupom invalido ou esgotado.");
    Map<String, Object> coupon = matches.get(0);
    if (quote.subtotalCents < ((Number) coupon.get("minimum_order_cents")).longValue()) {
      bad("Pedido abaixo do minimo do cupom.");
    }
    long value = ((Number) coupon.get("discount_value")).longValue();
    long discount = "percentage".equals(coupon.get("discount_type"))
        ? Math.floorDiv(Math.multiplyExact(quote.subtotalCents, value), 100)
        : value;
    Number maximum = (Number) coupon.get("maximum_discount_cents");
    if (maximum != null) discount = Math.min(discount, maximum.longValue());
    quote.discountCents = Math.min(discount, quote.subtotalCents);
    quote.couponId = (UUID) coupon.get("id");
  }

  private void validateSchedule(Map<String, Object> store, Instant scheduledFor) {
    ZoneId zone = ZoneId.of((String) store.get("timezone"));
    ZonedDateTime time;
    if (scheduledFor == null) {
      if (!"open".equals(store.get("operation_status"))) bad("A loja esta fechada para pedidos imediatos.");
      time = ZonedDateTime.now(zone);
    } else {
      if (!Boolean.TRUE.equals(store.get("accepts_preorders"))) bad("Esta loja nao aceita encomendas.");
      if (scheduledFor.isBefore(Instant.now().plusSeconds(15 * 60))
          || scheduledFor.isAfter(Instant.now().plusSeconds(14L * 24 * 3600))) {
        bad("Escolha um horario entre 15 minutos e 14 dias.");
      }
      time = scheduledFor.atZone(zone);
    }
    List<Map<String, Object>> hours = jdbc.queryForList(
        "SELECT weekday, opens_at, closes_at FROM business_hours WHERE store_id = ?", store.get("id"));
    if (hours.stream().noneMatch(hour -> includes(hour, time))) bad("Loja fechada no horario escolhido.");
  }

  private boolean includes(Map<String, Object> hour, ZonedDateTime time) {
    int weekday = ((Number) hour.get("weekday")).intValue();
    LocalTime opens = ((Time) hour.get("opens_at")).toLocalTime();
    LocalTime closes = ((Time) hour.get("closes_at")).toLocalTime();
    int current = time.getDayOfWeek().getValue();
    if (closes.isAfter(opens)) {
      return weekday == current && !time.toLocalTime().isBefore(opens) && time.toLocalTime().isBefore(closes);
    }
    int previous = current == 1 ? 7 : current - 1;
    return weekday == current && !time.toLocalTime().isBefore(opens)
        || weekday == previous && time.toLocalTime().isBefore(closes);
  }

  private Map<String, Object> single(String sql, Object... params) {
    List<Map<String, Object>> rows = jdbc.queryForList(sql, params);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private void bad(String message) {
    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }

  public static class QuoteInput {
    public List<ItemInput> items;
    public String fulfillmentType;
    public String zipCode;
    public String couponCode;
    public Instant scheduledFor;
  }

  public static class ItemInput {
    public UUID productId;
    public int quantity;
    public List<UUID> optionIds;
  }

  public static class Choice {
    public UUID optionId;
    public String name;
    public long priceDeltaCents;
  }

  public static class Line {
    public UUID productId;
    public String name;
    public long basePriceCents;
    public long unitPriceCents;
    public int quantity;
    public List<Choice> options = new ArrayList<>();
  }

  public static class Quote {
    public UUID storeId;
    public String fulfillmentType;
    public Instant scheduledFor;
    public List<Line> lines = new ArrayList<>();
    public long subtotalCents;
    public long discountCents;
    public long deliveryFeeCents;
    public long totalCents;
    public UUID couponId;

    public Map<String, Object> publicView() {
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("items", lines);
      result.put("subtotal_cents", subtotalCents);
      result.put("discount_cents", discountCents);
      result.put("delivery_fee_cents", deliveryFeeCents);
      result.put("total_cents", totalCents);
      result.put("fulfillment_type", fulfillmentType);
      result.put("scheduled_for", scheduledFor);
      return result;
    }
  }
}
