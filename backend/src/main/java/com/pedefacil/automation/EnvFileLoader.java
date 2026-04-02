package com.pedefacil.automation;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public final class EnvFileLoader {

  private EnvFileLoader() {
  }

  public static void loadDefaults() {
    // Prioriza backend/.env quando o comando roda na raiz do projeto.
    // Fallback para .env quando o comando roda dentro da pasta backend.
    loadFile(Path.of("backend", ".env"));
    loadFile(Path.of(".env"));
  }

  private static void loadFile(Path path) {
    if (!Files.exists(path) || !Files.isRegularFile(path)) {
      return;
    }

    try {
      List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
      for (String rawLine : lines) {
        String line = rawLine == null ? "" : rawLine.trim();
        if (line.isEmpty() || line.startsWith("#")) {
          continue;
        }

        int separator = line.indexOf('=');
        if (separator <= 0) {
          continue;
        }

        String key = line.substring(0, separator).trim();
        if (key.isEmpty()) {
          continue;
        }

        String value = line.substring(separator + 1).trim();
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length() - 1);
        }

        // Não sobrescreve env real do SO nem system property já definida.
        if (System.getenv(key) == null && System.getProperty(key) == null) {
          System.setProperty(key, value);
        }
      }
    } catch (IOException ignored) {
      // Em caso de erro de leitura, segue o boot com env padrão do sistema.
    }
  }
}
