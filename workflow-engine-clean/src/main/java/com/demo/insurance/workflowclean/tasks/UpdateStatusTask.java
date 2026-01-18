package com.demo.insurance.workflowclean.tasks;

import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Component("updateStatusTask")
public class UpdateStatusTask implements JavaDelegate {

  private final AppConfig cfg;
  private final RestTemplate http = new RestTemplate();

  // injected from BPMN <flowable:field ...><flowable:string>...</flowable:string>
  private Expression status;
  private Expression message;

  public UpdateStatusTask(AppConfig cfg) {
    this.cfg = cfg;
  }

  public void setStatus(Expression status) { this.status = status; }
  public void setMessage(Expression message) { this.message = message; }

  @Override
  public void execute(DelegateExecution ex) {
    String claimId = String.valueOf(ex.getVariable("claimId"));
    if (claimId == null || "null".equals(claimId)) return;

    String st = status != null ? String.valueOf(status.getValue(ex)) : "IN_REVIEW";
    String msg = message != null ? String.valueOf(message.getValue(ex)) : "";

    String url = cfg.getClaimBaseUrl() + "/claims/" + claimId + "/status";

    HttpHeaders h = new HttpHeaders();
    h.setContentType(MediaType.APPLICATION_JSON);

    http.exchange(
      url,
      HttpMethod.POST,
      new HttpEntity<>(Map.of("status", st, "message", msg), h),
      Object.class
    );
  }
}
