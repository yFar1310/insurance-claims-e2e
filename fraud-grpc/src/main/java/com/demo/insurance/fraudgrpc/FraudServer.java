package com.demo.insurance.fraudgrpc;

import io.grpc.Server;
import io.grpc.netty.shaded.io.grpc.netty.NettyServerBuilder;

public class FraudServer {

  public static void main(String[] args) throws Exception {
    // Prefer JVM prop, then env var, else default 9090
    String p = System.getProperty("GRPC_PORT");
    if (p == null || p.isBlank()) p = System.getenv("GRPC_PORT");
    if (p == null || p.isBlank()) p = "9090";

    int port = Integer.parseInt(p);

    Server server = NettyServerBuilder
        .forPort(port)
        .addService(new FraudServiceImpl())
        .build()
        .start();

    System.out.println("Fraud gRPC server started on port " + port);

    Runtime.getRuntime().addShutdownHook(new Thread(() -> {
      System.out.println("Shutting down Fraud gRPC server...");
      server.shutdown();
    }));

    server.awaitTermination();
  }
}
