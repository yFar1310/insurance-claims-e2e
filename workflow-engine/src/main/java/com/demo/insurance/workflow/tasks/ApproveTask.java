package com.demo.insurance.workflow.tasks;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.springframework.stereotype.Component;

@Component("approveTask")
public class ApproveTask implements JavaDelegate {
  private final ClaimRestClient rest;

  public ApproveTask(ClaimRestClient rest) { this.rest = rest; }

  @Override
  public void execute(DelegateExecution execution) {
    String claimId = (String) execution.getVariable("claimId");
    rest.updateStatus(claimId, "APPROVED", "Workflow approved the claim");
  }
}
