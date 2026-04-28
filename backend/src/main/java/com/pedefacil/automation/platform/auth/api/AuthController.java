package com.pedefacil.automation.platform.auth.api;

import com.pedefacil.automation.platform.auth.service.AuthService;
import javax.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final AuthService authService;

  public AuthController(AuthService authService) {
    this.authService = authService;
  }

  @PostMapping("/register")
  public AuthTokensResponse register(@Valid @RequestBody RegisterRequest request) {
    return authService.register(request);
  }

  @PostMapping("/login")
  public AuthTokensResponse login(@Valid @RequestBody LoginRequest request) {
    return authService.login(request);
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
  public AuthTokensResponse refresh(@Valid @RequestBody RefreshTokenRequest request) {
    return authService.refresh(request.getRefreshToken());
  }
}
