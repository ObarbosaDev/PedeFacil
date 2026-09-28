package com.pedefacil.automation;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:pedefacil_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
    "spring.flyway.enabled=false",
    "payments.strict-startup-validation=false",
    "payments.ops-monitoring-enabled=false",
    "payments.trial-rollover-enabled=false",
    "platform.auth.jwt-secret=0123456789abcdef0123456789abcdef"
})
class AutomationReceiverApplicationTests {

  @Test
  void contextLoads() {
  }
}

