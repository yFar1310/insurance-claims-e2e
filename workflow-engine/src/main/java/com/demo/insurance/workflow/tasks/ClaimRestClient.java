package com.demo.insurance.workflow.tasks;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component
public class ClaimRestClient {
  private final RestClient rest = RestClient.create("http://localhost:8080");

  public void updateStatus(String claimId, String status, String message) {
    // We haven't implemented update endpoint yet => we will add it now in claim-rest next
    // Placeholder: for now we just print.
    System.out.println("[REST] updateStatus claimId=" + claimId + " status=" + status + " message=" + message);
  }
}
