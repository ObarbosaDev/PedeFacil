package com.pedefacil.automation;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class AutomationReceiverApplication {

  public static void main(String[] args) {
    EnvFileLoader.loadDefaults();
    SpringApplication.run(AutomationReceiverApplication.class, args);
  }
}

