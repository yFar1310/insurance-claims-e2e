package com.demo.insurance.workflowclean.tasks;

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

  private final AppConfig cfg;

  public FraudTask(AppConfig cfg) {
    this.cfg = cfg;
  }

  @Override
  public void execute(DelegateExecution ex) {
    String claimId = String.valueOf(ex.getVariable("claimId"));
    String policyNumber = String.valueOf(ex.getVariable("policyNumber"));
    String claimType = String.valueOf(ex.getVariable("claimType"));
    double claimedAmount = Double.parseDouble(String.valueOf(ex.getVariable("claimedAmount")));

    ManagedChannel channel = ManagedChannelBuilder
    .forAddress(cfg.getGrpcHost(), cfg.getGrpcPort())
      .usePlaintext()
      .build();

    try {
      FraudDetectionServiceGrpc.FraudDetectionServiceBlockingStub stub =
        FraudDetectionServiceGrpc.newBlockingStub(channel);

      FraudRequest req = FraudRequest.newBuilder()
        .setClaimId(claimId)
        .setPolicyNumber(policyNumber)
        .setClaimedAmount(claimedAmount)
        .setClaimType(claimType)
        .build();

      FraudReply res = stub.analyze(req);

      ex.setVariable("fraudRisk", res.getRisk());
      ex.setVariable("fraudScore", res.getScore());
      ex.setVariable("fraudExplanation", res.getExplanation());
    } finally {
      channel.shutdown();
    }
  }
}
