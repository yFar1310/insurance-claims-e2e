package com.demo.insurance.fraudgrpc;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;

public class FraudClient {
  public static void main(String[] args) {
    ManagedChannel channel = ManagedChannelBuilder
        .forAddress("localhost", 9090)
        .usePlaintext()
        .build();

    FraudDetectionServiceGrpc.FraudDetectionServiceBlockingStub stub =
        FraudDetectionServiceGrpc.newBlockingStub(channel);

    FraudRequest req = FraudRequest.newBuilder()
        .setClaimId("CLM-demo")
        .setPolicyNumber("POL-123456")
        .setClaimedAmount(1200.5)
        .setClaimType("ACCIDENT")
        .build();

    FraudReply res = stub.analyze(req);
    System.out.println("risk=" + res.getRisk() + " score=" + res.getScore() + " explanation=" + res.getExplanation());

    channel.shutdown();
  }
}
