package com.pedefacil.automation.platform.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Map;
import javax.crypto.SecretKey;

public class JwtService {

  private final PlatformAuthProperties properties;

  public JwtService(PlatformAuthProperties properties) {
    this.properties = properties;
  }

  public String issueAccessToken(String userId, String email, String role) {
    return Jwts.builder()
        .setSubject(userId)
        .setIssuedAt(new Date())
        .setExpiration(Date.from(Instant.now().plus(properties.getAccessTokenMinutes(), ChronoUnit.MINUTES)))
        .addClaims(Map.of(
            "email", email,
            "role", role,
            "typ", "access"))
        .signWith(getKey(), SignatureAlgorithm.HS256)
        .compact();
  }

  private SecretKey getKey() {
    String secret = properties.getJwtSecret();
    if (secret == null || secret.trim().isEmpty()) {
      throw new IllegalStateException("APP_AUTH_JWT_SECRET nao configurado.");
    }
    return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
  }
}
