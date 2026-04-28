package com.pedefacil.automation.platform.auth.repo;

import com.pedefacil.automation.platform.auth.model.AppRefreshToken;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppRefreshTokenRepository extends JpaRepository<AppRefreshToken, UUID> {
  Optional<AppRefreshToken> findByToken(String token);
}
