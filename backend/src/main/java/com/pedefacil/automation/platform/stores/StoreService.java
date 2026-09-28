package com.pedefacil.automation.platform.stores;

import java.text.Normalizer;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StoreService {
  private static final Set<String> SEGMENTS = Set.of("pizzaria", "hamburgueria", "acaiteria", "restaurante");
  private static final Set<String> OPERATION_STATUSES = Set.of("open", "closed", "preorder");
  private final JdbcTemplate jdbc;

  public StoreService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public Map<String, Object> publicStore(String slug) {
    List<Map<String, Object>> stores = jdbc.queryForList(
        "SELECT id, slug, name, segment, phone, description, logo_path, cover_path, street, number, "
            + "neighborhood, city, state, zip_code, timezone, operation_status, accepts_preorders, "
            + "delivery_enabled, pickup_enabled FROM stores WHERE slug = ? AND published_at IS NOT NULL",
        slug);
    if (stores.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Loja nao encontrada.");
    }
    Map<String, Object> store = stores.get(0);
    store.put("business_hours", jdbc.queryForList(
        "SELECT weekday, opens_at, closes_at FROM business_hours WHERE store_id = ? ORDER BY weekday, opens_at",
        store.get("id")));
    return store;
  }

  public Map<String, Object> merchantStore(UUID storeId) {
    List<Map<String, Object>> stores = jdbc.queryForList("SELECT * FROM stores WHERE id = ?", storeId);
    if (stores.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Loja nao encontrada.");
    Map<String, Object> store = stores.get(0);
    store.put("business_hours", jdbc.queryForList(
        "SELECT weekday, opens_at, closes_at FROM business_hours WHERE store_id = ? ORDER BY weekday, opens_at", storeId));
    store.put("delivery_zones", jdbc.queryForList(
        "SELECT id, name, zip_prefix, fee_cents, minimum_order_cents, free_over_cents, active "
            + "FROM delivery_zones WHERE store_id = ? ORDER BY zip_prefix", storeId));
    return store;
  }

  @Transactional
  public Map<String, Object> create(UUID ownerId, StoreInput input) {
    Integer existing = jdbc.queryForObject(
        "SELECT COUNT(*) FROM stores WHERE owner_user_id = ?", Integer.class, ownerId);
    if (existing != null && existing > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Esta conta ja possui uma loja.");
    }
    validate(input);
    String slug = slugify(input.name);
    if (slug.length() < 3) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome da loja invalido.");
    try {
      UUID id = jdbc.queryForObject(
          "INSERT INTO stores (owner_user_id, slug, name, segment, phone, description, street, number, "
              + "neighborhood, city, state, zip_code, timezone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
          UUID.class, ownerId, slug, input.name.trim(), input.segment, input.phone, input.description,
          input.street, input.number, input.neighborhood, input.city, input.state, input.zipCode,
          input.timezone == null || input.timezone.isBlank() ? "America/Sao_Paulo" : input.timezone);
      jdbc.update("INSERT INTO store_members (store_id, user_id, role) VALUES (?, ?, 'owner')", id, ownerId);
      jdbc.update("INSERT INTO subscriptions (store_id, plan_slug, status, current_period_end) "
          + "VALUES (?, 'direto', 'trial', NOW() + INTERVAL '30 days')", id);
      return merchantStore(id);
    } catch (DuplicateKeyException exception) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe uma loja com esse nome no link publico.");
    }
  }

  public Map<String, Object> update(UUID storeId, StoreInput input) {
    validate(input);
    jdbc.update("UPDATE stores SET name = ?, segment = ?, phone = ?, description = ?, street = ?, number = ?, "
            + "neighborhood = ?, city = ?, state = ?, zip_code = ?, timezone = ?, updated_at = NOW() WHERE id = ?",
        input.name.trim(), input.segment, input.phone, input.description, input.street, input.number,
        input.neighborhood, input.city, input.state, input.zipCode,
        input.timezone == null || input.timezone.isBlank() ? "America/Sao_Paulo" : input.timezone, storeId);
    return merchantStore(storeId);
  }

  @Transactional
  public Map<String, Object> replaceHours(UUID storeId, List<HourInput> hours) {
    if (hours == null || hours.size() > 28) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Horarios invalidos.");
    }
    jdbc.update("DELETE FROM business_hours WHERE store_id = ?", storeId);
    for (HourInput hour : hours) {
      if (hour.weekday < 1 || hour.weekday > 7 || hour.opensAt == null || hour.closesAt == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Horario invalido.");
      }
      LocalTime opensAt;
      LocalTime closesAt;
      try {
        opensAt = LocalTime.parse(hour.opensAt);
        closesAt = LocalTime.parse(hour.closesAt);
      } catch (java.time.format.DateTimeParseException exception) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Formato de horario invalido.");
      }
      if (opensAt.equals(closesAt)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Horario de abertura e fechamento iguais.");
      jdbc.update("INSERT INTO business_hours (store_id, weekday, opens_at, closes_at) VALUES (?, ?, ?, ?)",
          storeId, hour.weekday, opensAt, closesAt);
    }
    return merchantStore(storeId);
  }

  @Transactional
  public Map<String, Object> replaceZones(UUID storeId, List<ZoneInput> zones) {
    if (zones == null || zones.size() > 50) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Zonas de entrega invalidas.");
    }
    jdbc.update("DELETE FROM delivery_zones WHERE store_id = ?", storeId);
    for (ZoneInput zone : zones) {
      if (zone.name == null || zone.name.isBlank() || zone.zipPrefix == null
          || !zone.zipPrefix.matches("[0-9]{3,8}") || zone.feeCents < 0 || zone.minimumOrderCents < 0) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Zona de entrega invalida.");
      }
      jdbc.update("INSERT INTO delivery_zones (store_id, name, zip_prefix, fee_cents, minimum_order_cents, free_over_cents) "
              + "VALUES (?, ?, ?, ?, ?, ?)",
          storeId, zone.name.trim(), zone.zipPrefix, zone.feeCents, zone.minimumOrderCents, zone.freeOverCents);
    }
    return merchantStore(storeId);
  }

  public Map<String, Object> publish(UUID storeId) {
    Map<String, Object> store = merchantStore(storeId);
    if (store.get("phone") == null || store.get("street") == null || store.get("city") == null) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Configure telefone e endereco antes de publicar.");
    }
    Integer productCount = jdbc.queryForObject(
        "SELECT COUNT(*) FROM products WHERE store_id = ? AND available = TRUE AND archived_at IS NULL", Integer.class, storeId);
    Integer hourCount = jdbc.queryForObject("SELECT COUNT(*) FROM business_hours WHERE store_id = ?", Integer.class, storeId);
    if (productCount == null || productCount == 0 || hourCount == null || hourCount == 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Cadastre produtos e horarios antes de publicar.");
    }
    jdbc.update("UPDATE stores SET published_at = COALESCE(published_at, NOW()), updated_at = NOW() WHERE id = ?", storeId);
    return merchantStore(storeId);
  }

  public Map<String, Object> changeOperation(UUID storeId, String status, boolean acceptsPreorders) {
    if (status == null || !OPERATION_STATUSES.contains(status)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status da loja invalido.");
    }
    jdbc.update("UPDATE stores SET operation_status = ?, accepts_preorders = ?, updated_at = NOW() WHERE id = ?",
        status, acceptsPreorders, storeId);
    return merchantStore(storeId);
  }

  private void validate(StoreInput input) {
    if (input == null || input.name == null || input.name.trim().length() < 3
        || input.name.length() > 120 || input.segment == null || !SEGMENTS.contains(input.segment)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome ou segmento invalido.");
    }
    if (input.timezone != null && !input.timezone.isBlank()) {
      try { java.time.ZoneId.of(input.timezone); }
      catch (Exception exception) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fuso horario invalido."); }
    }
  }

  private String slugify(String name) {
    String ascii = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    return ascii.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
  }

  public static class StoreInput {
    public String name;
    public String segment;
    public String phone;
    public String description;
    public String street;
    public String number;
    public String neighborhood;
    public String city;
    public String state;
    public String zipCode;
    public String timezone;
  }
  public static class HourInput { public int weekday; public String opensAt; public String closesAt; }
  public static class ZoneInput {
    public String name; public String zipPrefix; public long feeCents;
    public long minimumOrderCents; public Long freeOverCents;
  }
}
