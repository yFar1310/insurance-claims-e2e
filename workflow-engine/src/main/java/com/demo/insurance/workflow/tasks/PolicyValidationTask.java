package com.demo.insurance.workflow.tasks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component("policyValidationTask")
public class PolicyValidationTask implements JavaDelegate {

  private final RestClient rest = RestClient.create("http://localhost:8082");
  private final ObjectMapper om = new ObjectMapper();

  @Override
  public void execute(DelegateExecution execution) {
    try {
    String policyNumber = (String) execution.getVariable("policyNumber");
    String claimType = (String) execution.getVariable("claimType");
    Double claimedAmount = (Double) execution.getVariable("claimedAmount");

    String query = "query { covers(policyNumber:\\\"" + policyNumber + "\\\", claimType:\\\"" + claimType + "\\\", claimedAmount:" + claimedAmount + "){ covered reason maxPayable } }";

    String body = om.writeValueAsString(Map.of("query", query));

    String resp = rest.post()
        .uri("/graphql")
        .contentType(MediaType.APPLICATION_JSON)
        .body(body)
        .retrieve()
        .body(String.class);

    JsonNode root = om.readTree(resp);
    JsonNode covers = root.path("data").path("covers");
    boolean covered = covers.path("covered").asBoolean(false);

    execution.setVariable("policyCovered", covered);
  }
    catch (Exception e) {
      throw new RuntimeException("GraphQL policy validation failed", e);
    }
  }
}
