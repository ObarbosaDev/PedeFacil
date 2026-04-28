package com.pedefacil.automation.platform.auth.repo;

import com.pedefacil.automation.platform.auth.model.PasswordResetToken;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {
  Optional<PasswordResetToken> findByToken(String token);
}
