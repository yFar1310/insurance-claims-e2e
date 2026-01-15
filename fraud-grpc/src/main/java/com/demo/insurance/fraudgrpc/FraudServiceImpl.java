package com.demo.insurance.fraudgrpc;

import io.grpc.stub.StreamObserver;

public class FraudServiceImpl extends FraudDetectionServiceGrpc.FraudDetectionServiceImplBase {

  @Override
  public void analyze(FraudRequest request, StreamObserver<FraudReply> responseObserver) {

    double amount = request.getClaimedAmount();
    String type = request.getClaimType() == null ? "" : request.getClaimType().toUpperCase();

    // Simple simulated scoring (demo-friendly)
    double score = 0.15;
    if (amount > 3000) score += 0.35;
    if (amount > 8000) score += 0.30;
    if ("THEFT".equals(type)) score += 0.25;
    if (request.getPolicyNumber() != null && request.getPolicyNumber().endsWith("6")) score += 0.20;

    if (score > 1.0) score = 1.0;

    String risk = (score >= 0.75) ? "HIGH" : (score >= 0.40) ? "MEDIUM" : "LOW";

    FraudReply reply = FraudReply.newBuilder()
        .setRisk(risk)
        .setScore(score)
        .setExplanation("Simulated fraud scoring based on amount/type/policy pattern")
        .build();

    responseObserver.onNext(reply);
    responseObserver.onCompleted();
  }
}
