package com.pedefacil.automation.platform.auth.api;

import com.pedefacil.automation.platform.auth.service.AuthService;
import com.pedefacil.automation.platform.auth.PlatformAuthProperties;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final AuthService authService;
  private final PlatformAuthProperties properties;

  public AuthController(AuthService authService, PlatformAuthProperties properties) {
    this.authService = authService;
    this.properties = properties;
  }

  @PostMapping("/register")
  public AuthTokensResponse register(@Valid @RequestBody RegisterRequest request) {
    return authService.register(request);
  }

  @PostMapping("/login")
  public AuthTokensResponse login(@Valid @RequestBody LoginRequest request,
      HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
    AuthTokensResponse tokens = authService.login(request);
    setRefreshCookie(tokens, servletRequest, servletResponse);
    return tokens;
  }

  @GetMapping("/confirm-email")
  public MessageResponse confirmEmail(@RequestParam("token") String token) {
    return authService.confirmEmail(token);
  }

  @PostMapping("/password/reset-request")
  public MessageResponse requestPasswordReset(@Valid @RequestBody PasswordResetRequest request) {
    return authService.requestPasswordReset(request.getEmail());
  }

  @PostMapping("/password/reset-confirm")
  public MessageResponse confirmPasswordReset(@Valid @RequestBody PasswordResetConfirmRequest request) {
    return authService.confirmPasswordReset(request.getToken(), request.getNewPassword());
  }

  @PostMapping("/refresh")
  public AuthTokensResponse refresh(HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
    String refreshToken = readRefreshCookie(servletRequest);
    AuthTokensResponse tokens = authService.refresh(refreshToken);
    setRefreshCookie(tokens, servletRequest, servletResponse);
    return tokens;
  }

  @PostMapping("/logout")
  public MessageResponse logout(HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
    String token = readRefreshCookie(servletRequest);
    authService.revoke(token);
    servletResponse.addHeader(HttpHeaders.SET_COOKIE, refreshCookie("", servletRequest, 0).toString());
    return new MessageResponse("Sessao encerrada.");
  }

  private String readRefreshCookie(HttpServletRequest request) {
    if (request.getCookies() != null) {
      for (javax.servlet.http.Cookie cookie : request.getCookies()) {
        if ("pf_refresh".equals(cookie.getName())) return cookie.getValue();
      }
    }
    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sessao expirada.");
  }

  private void setRefreshCookie(AuthTokensResponse tokens, HttpServletRequest request,
      HttpServletResponse response) {
    response.addHeader(HttpHeaders.SET_COOKIE,
        refreshCookie(tokens.getRefreshToken(), request, properties.getRefreshTokenDays() * 24L * 3600L).toString());
    tokens.setRefreshToken(null);
  }

  private ResponseCookie refreshCookie(String token, HttpServletRequest request, long maxAge) {
    return ResponseCookie.from("pf_refresh", token).httpOnly(true).secure(request.isSecure())
        .sameSite("Strict").path("/api/auth").maxAge(maxAge).build();
  }
}
