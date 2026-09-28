package com.pedefacil.automation.platform.orders;

import java.util.Map;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/stores/{slug}")
public class OrderQuoteController {
  private final OrderQuoteService quotes;

  public OrderQuoteController(OrderQuoteService quotes) {
    this.quotes = quotes;
  }

  @PostMapping("/quote")
  public Map<String, Object> quote(@PathVariable String slug,
      @RequestBody OrderQuoteService.QuoteInput input) {
    return quotes.calculate(slug, input).publicView();
  }
}
