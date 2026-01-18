package com.demo.insurance.workflowclean.tasks;

import org.flowable.engine.RuntimeService;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Component("submitClaimTask")
public class SubmitClaimTask implements JavaDelegate {

  private final AppConfig cfg;
  private final RestTemplate http = new RestTemplate();
  private final RuntimeService runtimeService;

  public SubmitClaimTask(AppConfig cfg, RuntimeService runtimeService) {
    this.cfg = cfg;
    this.runtimeService = runtimeService;
  }

  @Override
  public void execute(DelegateExecution ex) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("customerId", ex.getVariable("customerId"));
    body.put("fullName", ex.getVariable("fullName"));
    body.put("policyNumber", ex.getVariable("policyNumber"));
    body.put("claimType", ex.getVariable("claimType"));
    body.put("claimedAmount", ex.getVariable("claimedAmount"));
    body.put("description", ex.getVariable("description"));

    String url = cfg.getClaimBaseUrl() + "/claims";

    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);

    ResponseEntity<Map> res = http.exchange(url, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
    Map<?, ?> claim = res.getBody();
    if (claim == null || claim.get("id") == null) throw new RuntimeException("claim-rest returned no id");

    String claimId = String.valueOf(claim.get("id"));
    ex.setVariable("claimId", claimId);

    // set businessKey = claimId (so /claims/{id}/tasks works)
    runtimeService.updateBusinessKey(ex.getProcessInstanceId(), claimId);
  }
}
