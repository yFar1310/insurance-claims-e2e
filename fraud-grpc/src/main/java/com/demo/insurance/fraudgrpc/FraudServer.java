package com.demo.insurance.fraudgrpc;

import io.grpc.Server;
import io.grpc.ServerBuilder;

public class FraudServer {
  public static void main(String[] args) throws Exception {
    int port = 8083;

    Server server = ServerBuilder
        .forPort(port)
        .addService(new FraudServiceImpl())
        .build()
        .start();

    System.out.println("[gRPC] FraudDetectionService started on port " + port);

    Runtime.getRuntime().addShutdownHook(new Thread(() -> {
      System.out.println("[gRPC] shutting down...");
      server.shutdown();
    }));

    server.awaitTermination();
  }
}
