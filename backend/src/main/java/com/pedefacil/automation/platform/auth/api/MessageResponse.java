package com.pedefacil.automation.platform.auth.api;

public class MessageResponse {
  private String message;
  private String tokenPreview;

  public MessageResponse() {
  }

  public MessageResponse(String message) {
    this.message = message;
  }

  public String getMessage() { return message; }
  public void setMessage(String message) { this.message = message; }
  public String getTokenPreview() { return tokenPreview; }
  public void setTokenPreview(String tokenPreview) { this.tokenPreview = tokenPreview; }
}
