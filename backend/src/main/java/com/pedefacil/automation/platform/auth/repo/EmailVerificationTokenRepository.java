package com.pedefacil.automation.platform.auth.repo;

import com.pedefacil.automation.platform.auth.model.EmailVerificationToken;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, UUID> {
  Optional<EmailVerificationToken> findByToken(String token);
}
