package com.pedefacil.automation.platform.catalog;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CatalogService {
  private final JdbcTemplate jdbc;

  public CatalogService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public Map<String, Object> publicMenu(String slug) {
    List<Map<String, Object>> stores = jdbc.queryForList(
        "SELECT id, slug, name, operation_status, accepts_preorders FROM stores "
            + "WHERE slug = ? AND published_at IS NOT NULL", slug);
    if (stores.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Loja nao encontrada.");
    UUID storeId = (UUID) stores.get(0).get("id");
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("store", stores.get(0));
    response.put("categories", categories(storeId));
    response.put("products", products(storeId, true));
    return response;
  }

  public List<Map<String, Object>> categories(UUID storeId) {
    return jdbc.queryForList(
        "SELECT id, name, sort_order FROM categories WHERE store_id = ? AND archived_at IS NULL "
            + "ORDER BY sort_order, name", storeId);
  }

  public List<Map<String, Object>> products(UUID storeId, boolean publicOnly) {
    String sql = "SELECT id, category_id, name, description, price_cents, image_path, available, sort_order "
        + "FROM products WHERE store_id = ? AND archived_at IS NULL "
        + (publicOnly ? "AND available = TRUE " : "")
        + "ORDER BY sort_order, name";
    List<Map<String, Object>> products = jdbc.queryForList(sql, storeId);
    for (Map<String, Object> product : products) {
      UUID productId = (UUID) product.get("id");
      List<Map<String, Object>> groups = jdbc.queryForList(
          "SELECT id, name, min_select, max_select, sort_order FROM product_option_groups "
              + "WHERE store_id = ? AND product_id = ? ORDER BY sort_order, name", storeId, productId);
      for (Map<String, Object> group : groups) {
        group.put("options", jdbc.queryForList(
            "SELECT id, name, price_delta_cents, available, sort_order FROM product_options "
                + "WHERE store_id = ? AND group_id = ? "
                + (publicOnly ? "AND available = TRUE " : "")
                + "ORDER BY sort_order, name", storeId, group.get("id")));
      }
      product.put("option_groups", groups);
    }
    return products;
  }

  public Map<String, Object> createCategory(UUID storeId, CategoryInput input) {
    validateName(input == null ? null : input.name);
    UUID id = jdbc.queryForObject(
        "INSERT INTO categories (store_id, name, sort_order) VALUES (?, ?, ?) RETURNING id",
        UUID.class, storeId, input.name.trim(), input.sortOrder);
    return category(storeId, id);
  }

  public Map<String, Object> updateCategory(UUID storeId, UUID id, CategoryInput input) {
    validateName(input == null ? null : input.name);
    updateOrNotFound(
        "UPDATE categories SET name = ?, sort_order = ? WHERE store_id = ? AND id = ? AND archived_at IS NULL",
        input.name.trim(), input.sortOrder, storeId, id);
    return category(storeId, id);
  }

  public Map<String, Object> createProduct(UUID storeId, ProductInput input) {
    validateProduct(storeId, input);
    UUID id = jdbc.queryForObject(
        "INSERT INTO products (store_id, category_id, name, description, price_cents, available, sort_order) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
        UUID.class, storeId, input.categoryId, input.name.trim(), input.description,
        input.priceCents, input.available, input.sortOrder);
    return product(storeId, id);
  }

  public Map<String, Object> updateProduct(UUID storeId, UUID id, ProductInput input) {
    validateProduct(storeId, input);
    updateOrNotFound(
        "UPDATE products SET category_id = ?, name = ?, description = ?, price_cents = ?, available = ?, "
            + "sort_order = ?, updated_at = NOW() WHERE store_id = ? AND id = ? AND archived_at IS NULL",
        input.categoryId, input.name.trim(), input.description, input.priceCents,
        input.available, input.sortOrder, storeId, id);
    return product(storeId, id);
  }

  public Map<String, Object> setAvailability(UUID storeId, UUID id, boolean available) {
    updateOrNotFound("UPDATE products SET available = ?, updated_at = NOW() "
        + "WHERE store_id = ? AND id = ? AND archived_at IS NULL", available, storeId, id);
    return product(storeId, id);
  }

  public void archiveProduct(UUID storeId, UUID id) {
    updateOrNotFound("UPDATE products SET archived_at = NOW(), available = FALSE, updated_at = NOW() "
        + "WHERE store_id = ? AND id = ? AND archived_at IS NULL", storeId, id);
  }

  public Map<String, Object> createGroup(UUID storeId, UUID productId, GroupInput input) {
    requireProduct(storeId, productId);
    if (input == null || input.name == null || input.name.trim().isEmpty()
        || input.minSelect < 0 || input.maxSelect < input.minSelect || input.maxSelect > 30) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Grupo de adicionais invalido.");
    }
    UUID id = jdbc.queryForObject(
        "INSERT INTO product_option_groups (store_id, product_id, name, min_select, max_select, sort_order) "
            + "VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        UUID.class, storeId, productId, input.name.trim(), input.minSelect, input.maxSelect, input.sortOrder);
    return jdbc.queryForMap("SELECT id, name, min_select, max_select, sort_order FROM product_option_groups "
        + "WHERE store_id = ? AND id = ?", storeId, id);
  }

  public Map<String, Object> createOption(UUID storeId, UUID groupId, OptionInput input) {
    if (input == null || input.name == null || input.name.trim().isEmpty() || input.priceDeltaCents < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Adicional invalido.");
    }
    Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM product_option_groups WHERE store_id = ? AND id = ?",
        Integer.class, storeId, groupId);
    if (count == null || count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Grupo nao encontrado.");
    UUID id = jdbc.queryForObject(
        "INSERT INTO product_options (store_id, group_id, name, price_delta_cents, available, sort_order) "
            + "VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        UUID.class, storeId, groupId, input.name.trim(), input.priceDeltaCents, input.available, input.sortOrder);
    return option(storeId, id);
  }

  public Map<String, Object> updateOption(UUID storeId, UUID id, OptionInput input) {
    if (input == null || input.name == null || input.name.trim().isEmpty() || input.priceDeltaCents < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Adicional invalido.");
    }
    updateOrNotFound("UPDATE product_options SET name = ?, price_delta_cents = ?, available = ?, sort_order = ? "
        + "WHERE store_id = ? AND id = ?", input.name.trim(), input.priceDeltaCents,
        input.available, input.sortOrder, storeId, id);
    return option(storeId, id);
  }

  private Map<String, Object> category(UUID storeId, UUID id) {
    return jdbc.queryForMap("SELECT id, name, sort_order FROM categories WHERE store_id = ? AND id = ?", storeId, id);
  }

  private Map<String, Object> product(UUID storeId, UUID id) {
    List<Map<String, Object>> results = new ArrayList<>(products(storeId, false));
    return results.stream().filter(item -> id.equals(item.get("id"))).findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Produto nao encontrado."));
  }

  private Map<String, Object> option(UUID storeId, UUID id) {
    return jdbc.queryForMap("SELECT id, name, price_delta_cents, available, sort_order FROM product_options "
        + "WHERE store_id = ? AND id = ?", storeId, id);
  }

  private void requireProduct(UUID storeId, UUID productId) {
    Integer count = jdbc.queryForObject(
        "SELECT COUNT(*) FROM products WHERE store_id = ? AND id = ? AND archived_at IS NULL",
        Integer.class, storeId, productId);
    if (count == null || count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Produto nao encontrado.");
  }

  private void validateProduct(UUID storeId, ProductInput input) {
    validateName(input == null ? null : input.name);
    if (input.priceCents < 0 || input.priceCents > 100000000) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Preco invalido.");
    }
    if (input.categoryId != null) {
      Integer count = jdbc.queryForObject(
          "SELECT COUNT(*) FROM categories WHERE store_id = ? AND id = ? AND archived_at IS NULL",
          Integer.class, storeId, input.categoryId);
      if (count == null || count == 0) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Categoria invalida.");
      }
    }
  }

  private void validateName(String name) {
    if (name == null || name.trim().isEmpty() || name.trim().length() > 120) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome invalido.");
    }
  }

  private void updateOrNotFound(String sql, Object... params) {
    if (jdbc.update(sql, params) == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Registro nao encontrado.");
  }

  public static class CategoryInput { public String name; public int sortOrder; }
  public static class ProductInput {
    public UUID categoryId; public String name; public String description;
    public long priceCents; public boolean available = true; public int sortOrder;
  }
  public static class GroupInput {
    public String name; public int minSelect; public int maxSelect = 1; public int sortOrder;
  }
  public static class OptionInput {
    public String name; public long priceDeltaCents; public boolean available = true; public int sortOrder;
  }
}
