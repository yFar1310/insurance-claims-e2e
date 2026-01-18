package com.demo.insurance.workflowclean.tasks;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Component("claimStatusUpdateTask")
public class ClaimStatusUpdateTask implements JavaDelegate {

  private final AppConfig cfg;
  private final RestTemplate http = new RestTemplate();

  public ClaimStatusUpdateTask(AppConfig cfg) {
    this.cfg = cfg;
  }

  @Override
  public void execute(DelegateExecution ex) {
    String claimId = String.valueOf(ex.getVariable("claimId"));
    String status = String.valueOf(ex.getVariable("claimStatus"));
    String message = String.valueOf(ex.getVariable("claimStatusMessage"));

    String url = cfg.getClaimBaseUrl() + "/claims/" + claimId + "/status";

    http.exchange(
      url,
      HttpMethod.POST,
      new HttpEntity<>(Map.of(
        "status", status,
        "message", message == null ? "" : message
      ), jsonHeaders()),
      Object.class
    );
  }

  private HttpHeaders jsonHeaders() {
    HttpHeaders h = new HttpHeaders();
    h.setContentType(MediaType.APPLICATION_JSON);
    return h;
  }
}
