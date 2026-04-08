package com.pedefacil.automation.payment;

import java.io.IOException;
import java.util.UUID;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class PaymentsSecurityHeadersFilter extends OncePerRequestFilter {

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {

    String path = request.getRequestURI();
    if (path != null && path.startsWith("/api/payments")) {
      String requestId = request.getHeader("X-Request-Id");
      if (requestId == null || requestId.isBlank()) {
        requestId = UUID.randomUUID().toString();
      }
      MDC.put("requestId", requestId);
      response.setHeader("X-Request-Id", requestId);
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("X-Frame-Options", "DENY");
      response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      response.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
      response.setHeader("Cache-Control", "no-store, max-age=0");
    }

    try {
      filterChain.doFilter(request, response);
    } finally {
      MDC.remove("requestId");
    }
  }
}
