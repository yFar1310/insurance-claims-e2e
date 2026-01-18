package com.demo.insurance.workflowclean.tasks;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.springframework.stereotype.Component;

@Component("compensationTask")
public class CompensationTask implements JavaDelegate {
  @Override
  public void execute(DelegateExecution ex) {
    double claimed = Double.parseDouble(String.valueOf(ex.getVariable("claimedAmount")));
    double maxPayable = Double.parseDouble(String.valueOf(ex.getVariable("maxPayable")));
    double payable = Math.min(claimed, maxPayable);

    ex.setVariable("payableAmount", payable);
  }
}
