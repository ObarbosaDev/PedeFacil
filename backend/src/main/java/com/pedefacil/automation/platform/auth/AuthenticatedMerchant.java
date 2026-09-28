package com.pedefacil.automation.platform.auth;

import io.jsonwebtoken.Claims;
import java.util.UUID;
import javax.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class AuthenticatedMerchant {
  private final JwtService jwtService;
  private final JdbcTemplate jdbc;

  public AuthenticatedMerchant(JwtService jwtService, JdbcTemplate jdbc) {
    this.jwtService = jwtService;
    this.jdbc = jdbc;
  }

  public UUID requireOwner(HttpServletRequest request) {
    String header = request.getHeader("Authorization");
    if (header == null || !header.startsWith("Bearer ")) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Entre para acessar sua loja.");
    }
    try {
      Claims claims = jwtService.verifyAccessToken(header.substring(7));
      UUID userId = UUID.fromString(claims.getSubject());
      Integer valid = jdbc.queryForObject(
          "SELECT COUNT(*) FROM app_users WHERE id = ? AND role = 'STORE_OWNER' AND is_active = TRUE",
          Integer.class, userId);
      if (valid == null || valid != 1) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Conta sem acesso de lojista.");
      }
      return userId;
    } catch (ResponseStatusException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sessao invalida ou expirada.");
    }
  }

  public UUID requireStore(HttpServletRequest request) {
    UUID userId = requireOwner(request);
    return jdbc.query(
        "SELECT store_id FROM store_members WHERE user_id = ? AND role IN ('owner', 'manager') ORDER BY created_at LIMIT 1",
        result -> result.next() ? result.getObject(1, UUID.class) : null,
        userId);
  }

  public UUID requireStoreOrThrow(HttpServletRequest request) {
    UUID storeId = requireStore(request);
    if (storeId == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Crie sua loja primeiro.");
    }
    return storeId;
  }
}
