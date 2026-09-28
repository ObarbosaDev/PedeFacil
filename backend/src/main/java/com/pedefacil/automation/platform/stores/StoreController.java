package com.pedefacil.automation.platform.stores;

import com.pedefacil.automation.platform.auth.AuthenticatedMerchant;
import java.util.List;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class StoreController {
  private final StoreService stores;
  private final AuthenticatedMerchant auth;

  public StoreController(StoreService stores, AuthenticatedMerchant auth) {
    this.stores = stores;
    this.auth = auth;
  }

  @GetMapping("/public/stores/{slug}")
  public Map<String, Object> publicStore(@PathVariable String slug) { return stores.publicStore(slug); }

  @GetMapping("/merchant/store")
  public Map<String, Object> myStore(HttpServletRequest request) {
    return stores.merchantStore(auth.requireStoreOrThrow(request));
  }

  @PostMapping("/merchant/store")
  public Map<String, Object> create(HttpServletRequest request, @RequestBody StoreService.StoreInput input) {
    return stores.create(auth.requireOwner(request), input);
  }

  @PutMapping("/merchant/store")
  public Map<String, Object> update(HttpServletRequest request, @RequestBody StoreService.StoreInput input) {
    return stores.update(auth.requireStoreOrThrow(request), input);
  }

  @PutMapping("/merchant/store/hours")
  public Map<String, Object> hours(HttpServletRequest request, @RequestBody List<StoreService.HourInput> hours) {
    return stores.replaceHours(auth.requireStoreOrThrow(request), hours);
  }

  @PutMapping("/merchant/store/delivery-zones")
  public Map<String, Object> zones(HttpServletRequest request, @RequestBody List<StoreService.ZoneInput> zones) {
    return stores.replaceZones(auth.requireStoreOrThrow(request), zones);
  }

  @PostMapping("/merchant/store/publish")
  public Map<String, Object> publish(HttpServletRequest request) {
    return stores.publish(auth.requireStoreOrThrow(request));
  }

  @PatchMapping("/merchant/store/operation")
  public Map<String, Object> operation(HttpServletRequest request, @RequestBody OperationInput input) {
    return stores.changeOperation(auth.requireStoreOrThrow(request), input.status, input.acceptsPreorders);
  }

  public static class OperationInput { public String status; public boolean acceptsPreorders; }
}
