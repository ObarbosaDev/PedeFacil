package com.pedefacil.automation.platform.orders;

import com.pedefacil.automation.platform.auth.AuthenticatedMerchant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class OrderController {
  private final OrderService orders;
  private final AuthenticatedMerchant auth;

  public OrderController(OrderService orders, AuthenticatedMerchant auth) {
    this.orders = orders;
    this.auth = auth;
  }

  @PostMapping("/public/stores/{slug}/orders")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> create(@PathVariable String slug,
      @RequestHeader("Idempotency-Key") String idempotencyKey,
      @RequestBody OrderService.OrderInput input) {
    return orders.create(slug, idempotencyKey, input);
  }

  @GetMapping("/public/orders/{token}")
  public Map<String, Object> tracking(@PathVariable String token) {
    return orders.tracking(token);
  }

  @GetMapping("/merchant/orders")
  public List<Map<String, Object>> merchantOrders(HttpServletRequest request) {
    return orders.merchantOrders(auth.requireStoreOrThrow(request));
  }

  @PatchMapping("/merchant/orders/{id}/status")
  public Map<String, Object> changeStatus(HttpServletRequest request, @PathVariable UUID id,
      @RequestBody OrderService.StatusInput input) {
    UUID actorId = auth.requireOwner(request);
    UUID storeId = auth.requireStoreOrThrow(request);
    return orders.changeStatus(storeId, id, actorId, input);
  }
}
