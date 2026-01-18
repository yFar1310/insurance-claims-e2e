package com.demo.insurance.identitysoap;

import jakarta.xml.ws.Endpoint;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class SoapPublisher implements CommandLineRunner {

  @Override
  public void run(String... args) {
    String address = "http://0.0.0.0:8082/ws/identity";
    Endpoint.publish(address, new IdentityVerificationService());
    System.out.println("[SOAP] IdentityVerificationService published at: " + address);
    System.out.println("[SOAP] WSDL available at: " + address + "?wsdl");
  }
}
