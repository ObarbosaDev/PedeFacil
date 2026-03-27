package com.pedefacil.automation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OutboundService {

  private static final Logger log = LoggerFactory.getLogger(OutboundService.class);

  private final AutomationProperties properties;
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;

  public OutboundService(AutomationProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    this.httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();
  }

  public void dispatch(String rawPayload) {
    JsonNode payload;
    try {
      payload = objectMapper.readTree(rawPayload);
    } catch (IOException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payload JSON invalido", ex);
    }

    String mode = safe(properties.getOutboundMode(), "log");
    switch (mode.toLowerCase()) {
      case "log":
        log.info("[automation] outbound_mode=log payload={}", rawPayload);
        return;
      case "webhook":
        sendWebhook(rawPayload);
        return;
      case "evolution":
        sendEvolution(payload);
        return;
      case "zapi":
        sendZapi(payload);
        return;
      default:
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "OUTBOUND_MODE invalido. Use: log, webhook, evolution ou zapi");
    }
  }

  private void sendWebhook(String rawPayload) {
    String url = required(properties.getOutboundUrl(), "AUTOMATION_OUTBOUND_URL");
    HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(url))
        .timeout(Duration.ofSeconds(20))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(rawPayload));

    if (!isBlank(properties.getOutboundBearerToken())) {
      request.header("Authorization", "Bearer " + properties.getOutboundBearerToken());
    }

    send(request.build(), "webhook");
  }

  private void sendEvolution(JsonNode payload) {
    String baseUrl = required(properties.getEvolutionBaseUrl(), "AUTOMATION_EVOLUTION_BASE_URL");
    String apiKey = required(properties.getEvolutionApiKey(), "AUTOMATION_EVOLUTION_API_KEY");
    String instance = required(properties.getEvolutionInstance(), "AUTOMATION_EVOLUTION_INSTANCE");

    String phone = required(extractPhone(payload), "phone no payload");
    String message = required(extractMessage(payload), "message no payload");

    Map<String, Object> body = new HashMap<>();
    body.put("number", phone);
    body.put("text", message);

    HttpRequest request = HttpRequest.newBuilder(
            URI.create(baseUrl + "/message/sendText/" + instance))
        .timeout(Duration.ofSeconds(20))
        .header("Content-Type", "application/json")
        .header("apikey", apiKey)
        .POST(HttpRequest.BodyPublishers.ofString(writeJson(body)))
        .build();

    send(request, "evolution");
  }

  private void sendZapi(JsonNode payload) {
    String baseUrl = required(properties.getZapiBaseUrl(), "AUTOMATION_ZAPI_BASE_URL");
    String instance = required(properties.getZapiInstance(), "AUTOMATION_ZAPI_INSTANCE");
    String token = required(properties.getZapiToken(), "AUTOMATION_ZAPI_TOKEN");

    String phone = required(extractPhone(payload), "phone no payload");
    String message = required(extractMessage(payload), "message no payload");

    Map<String, Object> body = new HashMap<>();
    body.put("phone", phone);
    body.put("message", message);

    HttpRequest request = HttpRequest.newBuilder(
            URI.create(baseUrl + "/instances/" + instance + "/token/" + token + "/send-text"))
        .timeout(Duration.ofSeconds(20))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(writeJson(body)))
        .build();

    send(request, "zapi");
  }

  private void send(HttpRequest request, String mode) {
    try {
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      int statusCode = response.statusCode();
      if (statusCode < 200 || statusCode >= 300) {
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
            "Falha no envio " + mode + ". Status: " + statusCode + " Body: " + response.body());
      }
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
          "Falha ao conectar no provedor " + mode, ex);
    } catch (IOException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
          "Falha ao conectar no provedor " + mode, ex);
    }
  }

  private String extractPhone(JsonNode payload) {
    return firstText(payload,
        "/phone",
        "/customer_phone",
        "/to",
        "/order/customer_phone",
        "/payload/customer_phone");
  }

  private String extractMessage(JsonNode payload) {
    return firstText(payload,
        "/message",
        "/text",
        "/payload/message",
        "/payload/text");
  }

  private String firstText(JsonNode payload, String... pointers) {
    for (String pointer : pointers) {
      JsonNode node = payload.at(pointer);
      if (node != null && !node.isMissingNode() && !node.isNull()) {
        String text = node.asText();
        if (!isBlank(text)) {
          return text;
        }
      }
    }
    return null;
  }

  private String writeJson(Object body) {
    try {
      return objectMapper.writeValueAsString(body);
    } catch (IOException ex) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
          "Falha ao serializar JSON", ex);
    }
  }

  private String required(String value, String field) {
    if (isBlank(value)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Configuracao obrigatoria ausente: " + field);
    }
    return value;
  }

  private String safe(String value, String fallback) {
    return isBlank(value) ? fallback : value;
  }

  private boolean isBlank(String value) {
    return value == null || value.isBlank();
  }
}

