package com.demo.insurance.workflow.tasks;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.springframework.stereotype.Component;

@Component("rejectTask")
public class RejectTask implements JavaDelegate {
  private final ClaimRestClient rest;

  public RejectTask(ClaimRestClient rest) { this.rest = rest; }

  @Override
  public void execute(DelegateExecution execution) {
    String claimId = (String) execution.getVariable("claimId");
    rest.updateStatus(claimId, "REJECTED", "Workflow rejected the claim");
  }
}
