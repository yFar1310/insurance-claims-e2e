package com.demo.insurance.workflowclean.tasks;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.springframework.stereotype.Component;

@Component("paymentTask")
public class PaymentTask implements JavaDelegate {
  @Override
  public void execute(DelegateExecution ex) {
    double payable = Double.parseDouble(String.valueOf(ex.getVariable("payableAmount")));
    boolean ok = payable <= 10000; // simulate: fail if absurd
    ex.setVariable("paymentOk", ok);
  }
}
