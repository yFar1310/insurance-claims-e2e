package com.demo.insurance.workflow.tasks;

import com.demo.insurance.fraudgrpc.FraudDetectionServiceGrpc;
import com.demo.insurance.fraudgrpc.FraudReply;
import com.demo.insurance.fraudgrpc.FraudRequest;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.springframework.stereotype.Component;

@Component("fraudTask")
public class FraudTask implements JavaDelegate {

  @Override
  public void execute(DelegateExecution execution) {
    String claimId = (String) execution.getVariable("claimId");
    String policyNumber = (String) execution.getVariable("policyNumber");
    String claimType = (String) execution.getVariable("claimType");
    Double claimedAmount = (Double) execution.getVariable("claimedAmount");

    ManagedChannel channel = ManagedChannelBuilder
        .forAddress("localhost", 8083)
        .usePlaintext()
        .build();

    try {
      FraudDetectionServiceGrpc.FraudDetectionServiceBlockingStub stub =
          FraudDetectionServiceGrpc.newBlockingStub(channel);

      FraudReply res = stub.analyze(FraudRequest.newBuilder()
          .setClaimId(claimId)
          .setPolicyNumber(policyNumber)
          .setClaimType(claimType)
          .setClaimedAmount(claimedAmount == null ? 0.0 : claimedAmount)
          .build());

      String risk = res.getRisk();
      execution.setVariable("fraudRisk", risk);

      boolean reject = "HIGH".equalsIgnoreCase(risk) && (claimedAmount != null && claimedAmount > 3000);
      execution.setVariable("fraudReject", reject);

    } finally {
      channel.shutdown();
    }
  }
}
