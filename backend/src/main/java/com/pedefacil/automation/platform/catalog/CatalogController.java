package com.pedefacil.automation.platform.catalog;

import com.pedefacil.automation.platform.auth.AuthenticatedMerchant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class CatalogController {
  private final CatalogService catalog;
  private final AuthenticatedMerchant auth;

  public CatalogController(CatalogService catalog, AuthenticatedMerchant auth) {
    this.catalog = catalog;
    this.auth = auth;
  }

  @GetMapping("/public/stores/{slug}/menu")
  public Map<String, Object> publicMenu(@PathVariable String slug) {
    return catalog.publicMenu(slug);
  }

  @GetMapping("/merchant/categories")
  public List<Map<String, Object>> categories(HttpServletRequest request) {
    return catalog.categories(auth.requireStoreOrThrow(request));
  }

  @PostMapping("/merchant/categories")
  public Map<String, Object> createCategory(HttpServletRequest request,
      @RequestBody CatalogService.CategoryInput input) {
    return catalog.createCategory(auth.requireStoreOrThrow(request), input);
  }

  @PutMapping("/merchant/categories/{id}")
  public Map<String, Object> updateCategory(HttpServletRequest request, @PathVariable UUID id,
      @RequestBody CatalogService.CategoryInput input) {
    return catalog.updateCategory(auth.requireStoreOrThrow(request), id, input);
  }

  @GetMapping("/merchant/products")
  public List<Map<String, Object>> products(HttpServletRequest request) {
    return catalog.products(auth.requireStoreOrThrow(request), false);
  }

  @PostMapping("/merchant/products")
  public Map<String, Object> createProduct(HttpServletRequest request,
      @RequestBody CatalogService.ProductInput input) {
    return catalog.createProduct(auth.requireStoreOrThrow(request), input);
  }

  @PutMapping("/merchant/products/{id}")
  public Map<String, Object> updateProduct(HttpServletRequest request, @PathVariable UUID id,
      @RequestBody CatalogService.ProductInput input) {
    return catalog.updateProduct(auth.requireStoreOrThrow(request), id, input);
  }

  @PatchMapping("/merchant/products/{id}/availability")
  public Map<String, Object> availability(HttpServletRequest request, @PathVariable UUID id,
      @RequestBody AvailabilityInput input) {
    return catalog.setAvailability(auth.requireStoreOrThrow(request), id, input.available);
  }

  @DeleteMapping("/merchant/products/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void archive(HttpServletRequest request, @PathVariable UUID id) {
    catalog.archiveProduct(auth.requireStoreOrThrow(request), id);
  }

  @PostMapping("/merchant/products/{id}/option-groups")
  public Map<String, Object> createGroup(HttpServletRequest request, @PathVariable UUID id,
      @RequestBody CatalogService.GroupInput input) {
    return catalog.createGroup(auth.requireStoreOrThrow(request), id, input);
  }

  @PostMapping("/merchant/option-groups/{id}/options")
  public Map<String, Object> createOption(HttpServletRequest request, @PathVariable UUID id,
      @RequestBody CatalogService.OptionInput input) {
    return catalog.createOption(auth.requireStoreOrThrow(request), id, input);
  }

  @PutMapping("/merchant/options/{id}")
  public Map<String, Object> updateOption(HttpServletRequest request, @PathVariable UUID id,
      @RequestBody CatalogService.OptionInput input) {
    return catalog.updateOption(auth.requireStoreOrThrow(request), id, input);
  }

  public static class AvailabilityInput { public boolean available; }
}
