package com.pedefacil.automation.platform.auth.service;

import com.pedefacil.automation.platform.auth.JwtService;
import com.pedefacil.automation.platform.auth.PlatformAuthProperties;
import com.pedefacil.automation.platform.auth.api.AuthTokensResponse;
import com.pedefacil.automation.platform.auth.api.AuthUserResponse;
import com.pedefacil.automation.platform.auth.api.LoginRequest;
import com.pedefacil.automation.platform.auth.api.MessageResponse;
import com.pedefacil.automation.platform.auth.api.RegisterRequest;
import com.pedefacil.automation.platform.auth.model.AppRefreshToken;
import com.pedefacil.automation.platform.auth.model.AppUser;
import com.pedefacil.automation.platform.auth.model.AppUserRole;
import com.pedefacil.automation.platform.auth.model.EmailVerificationToken;
import com.pedefacil.automation.platform.auth.model.PasswordResetToken;
import com.pedefacil.automation.platform.auth.repo.AppRefreshTokenRepository;
import com.pedefacil.automation.platform.auth.repo.AppUserRepository;
import com.pedefacil.automation.platform.auth.repo.EmailVerificationTokenRepository;
import com.pedefacil.automation.platform.auth.repo.PasswordResetTokenRepository;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

  private final AppUserRepository appUserRepository;
  private final EmailVerificationTokenRepository emailVerificationTokenRepository;
  private final PasswordResetTokenRepository passwordResetTokenRepository;
  private final AppRefreshTokenRepository appRefreshTokenRepository;
  private final PasswordEncoder passwordEncoder;
  private final PlatformAuthProperties properties;
  private final JwtService jwtService;
  private final AuthMailDispatcher authMailDispatcher;
  private final SecureRandom secureRandom = new SecureRandom();

  public AuthService(
      AppUserRepository appUserRepository,
      EmailVerificationTokenRepository emailVerificationTokenRepository,
      PasswordResetTokenRepository passwordResetTokenRepository,
      AppRefreshTokenRepository appRefreshTokenRepository,
      PasswordEncoder passwordEncoder,
      PlatformAuthProperties properties,
      JwtService jwtService,
      AuthMailDispatcher authMailDispatcher) {
    this.appUserRepository = appUserRepository;
    this.emailVerificationTokenRepository = emailVerificationTokenRepository;
    this.passwordResetTokenRepository = passwordResetTokenRepository;
    this.appRefreshTokenRepository = appRefreshTokenRepository;
    this.passwordEncoder = passwordEncoder;
    this.properties = properties;
    this.jwtService = jwtService;
    this.authMailDispatcher = authMailDispatcher;
  }

  @Transactional
  public AuthTokensResponse register(RegisterRequest request) {
    String normalizedEmail = normalizeEmail(request.getEmail());
    if (appUserRepository.existsByEmailIgnoreCase(normalizedEmail)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Ja existe conta com esse e-mail.");
    }

    AppUser user = new AppUser();
    user.setEmail(normalizedEmail);
    user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
    user.setFullName(request.getFullName().trim());
    user.setRole(parseRole(request.getRole()));
    user = appUserRepository.save(user);

    String verificationTokenValue = generateOpaqueToken();
    EmailVerificationToken verificationToken = new EmailVerificationToken();
    verificationToken.setUser(user);
    verificationToken.setToken(verificationTokenValue);
    verificationToken.setExpiresAt(OffsetDateTime.now().plusHours(properties.getEmailVerificationTokenHours()));
    emailVerificationTokenRepository.save(verificationToken);

    String confirmationUrl = properties.getAppBaseUrl() + "/auth/confirm-email?token=" + verificationTokenValue;
    authMailDispatcher.sendVerificationEmail(user, verificationTokenValue, confirmationUrl);

    AuthTokensResponse response = new AuthTokensResponse();
    response.setUser(toUserResponse(user));
    if (properties.isDebugExposeTokens()) {
      response.setVerificationTokenPreview(verificationTokenValue);
    }
    return response;
  }

  @Transactional
  public AuthTokensResponse login(LoginRequest request) {
    AppUser user = appUserRepository.findByEmailIgnoreCase(normalizeEmail(request.getEmail()))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciais invalidas."));

    if (!user.isActive()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Conta desativada.");
    }
    if (user.getEmailConfirmedAt() == null) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Confirme seu e-mail antes de entrar.");
    }
    if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciais invalidas.");
    }

    return issueTokens(user);
  }

  @Transactional
  public MessageResponse confirmEmail(String tokenValue) {
    EmailVerificationToken token = emailVerificationTokenRepository.findByToken(tokenValue)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Token de confirmacao nao encontrado."));

    if (token.getUsedAt() != null) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Esse token ja foi usado.");
    }
    if (token.getExpiresAt().isBefore(OffsetDateTime.now())) {
      throw new ResponseStatusException(HttpStatus.GONE, "Token de confirmacao expirado.");
    }

    AppUser user = token.getUser();
    user.setEmailConfirmedAt(OffsetDateTime.now());
    token.setUsedAt(OffsetDateTime.now());
    appUserRepository.save(user);
    emailVerificationTokenRepository.save(token);

    return new MessageResponse("E-mail confirmado. Sua conta ja pode entrar no sistema.");
  }

  @Transactional
  public MessageResponse requestPasswordReset(String email) {
    MessageResponse response = new MessageResponse("Se existir conta com esse e-mail, mandamos o link de redefinicao.");
    appUserRepository.findByEmailIgnoreCase(normalizeEmail(email)).ifPresent((user) -> {
      String tokenValue = generateOpaqueToken();
      PasswordResetToken token = new PasswordResetToken();
      token.setUser(user);
      token.setToken(tokenValue);
      token.setExpiresAt(OffsetDateTime.now().plusMinutes(properties.getPasswordResetTokenMinutes()));
      passwordResetTokenRepository.save(token);
      String resetUrl = properties.getAppBaseUrl() + "/redefinir-senha?token=" + tokenValue;
      authMailDispatcher.sendPasswordResetEmail(user, tokenValue, resetUrl);
      if (properties.isDebugExposeTokens()) {
        response.setTokenPreview(tokenValue);
      }
    });
    return response;
  }

  @Transactional
  public MessageResponse confirmPasswordReset(String tokenValue, String newPassword) {
    PasswordResetToken token = passwordResetTokenRepository.findByToken(tokenValue)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Token de redefinicao nao encontrado."));

    if (token.getUsedAt() != null) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Esse token ja foi usado.");
    }
    if (token.getExpiresAt().isBefore(OffsetDateTime.now())) {
      throw new ResponseStatusException(HttpStatus.GONE, "Token de redefinicao expirado.");
    }

    AppUser user = token.getUser();
    user.setPasswordHash(passwordEncoder.encode(newPassword));
    token.setUsedAt(OffsetDateTime.now());
    appUserRepository.save(user);
    passwordResetTokenRepository.save(token);

    return new MessageResponse("Senha atualizada com sucesso.");
  }

  @Transactional
  public AuthTokensResponse refresh(String refreshTokenValue) {
    AppRefreshToken refreshToken = appRefreshTokenRepository.findByToken(refreshTokenValue)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token invalido."));

    if (refreshToken.getRevokedAt() != null || refreshToken.getExpiresAt().isBefore(OffsetDateTime.now())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expirado ou revogado.");
    }

    refreshToken.setRevokedAt(OffsetDateTime.now());
    appRefreshTokenRepository.save(refreshToken);
    return issueTokens(refreshToken.getUser());
  }

  private AuthTokensResponse issueTokens(AppUser user) {
    AppRefreshToken refreshToken = new AppRefreshToken();
    refreshToken.setUser(user);
    refreshToken.setToken(generateOpaqueToken());
    refreshToken.setExpiresAt(OffsetDateTime.now().plusDays(properties.getRefreshTokenDays()));
    appRefreshTokenRepository.save(refreshToken);

    AuthTokensResponse response = new AuthTokensResponse();
    response.setAccessToken(jwtService.issueAccessToken(user.getId().toString(), user.getEmail(), user.getRole().name()));
    response.setRefreshToken(refreshToken.getToken());
    response.setUser(toUserResponse(user));
    return response;
  }

  private AuthUserResponse toUserResponse(AppUser user) {
    AuthUserResponse response = new AuthUserResponse();
    response.setId(user.getId());
    response.setEmail(user.getEmail());
    response.setFullName(user.getFullName());
    response.setRole(user.getRole().name());
    response.setEmailConfirmed(user.getEmailConfirmedAt() != null);
    return response;
  }

  private AppUserRole parseRole(String role) {
    try {
      return AppUserRole.valueOf(role.trim().toUpperCase(Locale.ROOT));
    } catch (Exception error) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role invalida.");
    }
  }

  private String normalizeEmail(String email) {
    return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
  }

  private String generateOpaqueToken() {
    byte[] bytes = new byte[32];
    secureRandom.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
}
