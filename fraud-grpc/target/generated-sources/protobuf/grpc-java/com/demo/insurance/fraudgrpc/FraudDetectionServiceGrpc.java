package com.demo.insurance.fraudgrpc;

import static io.grpc.MethodDescriptor.generateFullMethodName;

/**
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.64.0)",
    comments = "Source: fraud.proto")
@io.grpc.stub.annotations.GrpcGenerated
public final class FraudDetectionServiceGrpc {

  private FraudDetectionServiceGrpc() {}

  public static final java.lang.String SERVICE_NAME = "fraud.FraudDetectionService";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<com.demo.insurance.fraudgrpc.FraudRequest,
      com.demo.insurance.fraudgrpc.FraudReply> getAnalyzeMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "Analyze",
      requestType = com.demo.insurance.fraudgrpc.FraudRequest.class,
      responseType = com.demo.insurance.fraudgrpc.FraudReply.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<com.demo.insurance.fraudgrpc.FraudRequest,
      com.demo.insurance.fraudgrpc.FraudReply> getAnalyzeMethod() {
    io.grpc.MethodDescriptor<com.demo.insurance.fraudgrpc.FraudRequest, com.demo.insurance.fraudgrpc.FraudReply> getAnalyzeMethod;
    if ((getAnalyzeMethod = FraudDetectionServiceGrpc.getAnalyzeMethod) == null) {
      synchronized (FraudDetectionServiceGrpc.class) {
        if ((getAnalyzeMethod = FraudDetectionServiceGrpc.getAnalyzeMethod) == null) {
          FraudDetectionServiceGrpc.getAnalyzeMethod = getAnalyzeMethod =
              io.grpc.MethodDescriptor.<com.demo.insurance.fraudgrpc.FraudRequest, com.demo.insurance.fraudgrpc.FraudReply>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "Analyze"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.demo.insurance.fraudgrpc.FraudRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  com.demo.insurance.fraudgrpc.FraudReply.getDefaultInstance()))
              .setSchemaDescriptor(new FraudDetectionServiceMethodDescriptorSupplier("Analyze"))
              .build();
        }
      }
    }
    return getAnalyzeMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static FraudDetectionServiceStub newStub(io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<FraudDetectionServiceStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<FraudDetectionServiceStub>() {
        @java.lang.Override
        public FraudDetectionServiceStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new FraudDetectionServiceStub(channel, callOptions);
        }
      };
    return FraudDetectionServiceStub.newStub(factory, channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static FraudDetectionServiceBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<FraudDetectionServiceBlockingStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<FraudDetectionServiceBlockingStub>() {
        @java.lang.Override
        public FraudDetectionServiceBlockingStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new FraudDetectionServiceBlockingStub(channel, callOptions);
        }
      };
    return FraudDetectionServiceBlockingStub.newStub(factory, channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static FraudDetectionServiceFutureStub newFutureStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<FraudDetectionServiceFutureStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<FraudDetectionServiceFutureStub>() {
        @java.lang.Override
        public FraudDetectionServiceFutureStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new FraudDetectionServiceFutureStub(channel, callOptions);
        }
      };
    return FraudDetectionServiceFutureStub.newStub(factory, channel);
  }

  /**
   */
  public interface AsyncService {

    /**
     */
    default void analyze(com.demo.insurance.fraudgrpc.FraudRequest request,
        io.grpc.stub.StreamObserver<com.demo.insurance.fraudgrpc.FraudReply> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getAnalyzeMethod(), responseObserver);
    }
  }

  /**
   * Base class for the server implementation of the service FraudDetectionService.
   */
  public static abstract class FraudDetectionServiceImplBase
      implements io.grpc.BindableService, AsyncService {

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return FraudDetectionServiceGrpc.bindService(this);
    }
  }

  /**
   * A stub to allow clients to do asynchronous rpc calls to service FraudDetectionService.
   */
  public static final class FraudDetectionServiceStub
      extends io.grpc.stub.AbstractAsyncStub<FraudDetectionServiceStub> {
    private FraudDetectionServiceStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected FraudDetectionServiceStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new FraudDetectionServiceStub(channel, callOptions);
    }

    /**
     */
    public void analyze(com.demo.insurance.fraudgrpc.FraudRequest request,
        io.grpc.stub.StreamObserver<com.demo.insurance.fraudgrpc.FraudReply> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getAnalyzeMethod(), getCallOptions()), request, responseObserver);
    }
  }

  /**
   * A stub to allow clients to do synchronous rpc calls to service FraudDetectionService.
   */
  public static final class FraudDetectionServiceBlockingStub
      extends io.grpc.stub.AbstractBlockingStub<FraudDetectionServiceBlockingStub> {
    private FraudDetectionServiceBlockingStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected FraudDetectionServiceBlockingStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new FraudDetectionServiceBlockingStub(channel, callOptions);
    }

    /**
     */
    public com.demo.insurance.fraudgrpc.FraudReply analyze(com.demo.insurance.fraudgrpc.FraudRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getAnalyzeMethod(), getCallOptions(), request);
    }
  }

  /**
   * A stub to allow clients to do ListenableFuture-style rpc calls to service FraudDetectionService.
   */
  public static final class FraudDetectionServiceFutureStub
      extends io.grpc.stub.AbstractFutureStub<FraudDetectionServiceFutureStub> {
    private FraudDetectionServiceFutureStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected FraudDetectionServiceFutureStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new FraudDetectionServiceFutureStub(channel, callOptions);
    }

    /**
     */
    public com.google.common.util.concurrent.ListenableFuture<com.demo.insurance.fraudgrpc.FraudReply> analyze(
        com.demo.insurance.fraudgrpc.FraudRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getAnalyzeMethod(), getCallOptions()), request);
    }
  }

  private static final int METHODID_ANALYZE = 0;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final AsyncService serviceImpl;
    private final int methodId;

    MethodHandlers(AsyncService serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_ANALYZE:
          serviceImpl.analyze((com.demo.insurance.fraudgrpc.FraudRequest) request,
              (io.grpc.stub.StreamObserver<com.demo.insurance.fraudgrpc.FraudReply>) responseObserver);
          break;
        default:
          throw new AssertionError();
      }
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public io.grpc.stub.StreamObserver<Req> invoke(
        io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        default:
          throw new AssertionError();
      }
    }
  }

  public static final io.grpc.ServerServiceDefinition bindService(AsyncService service) {
    return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
        .addMethod(
          getAnalyzeMethod(),
          io.grpc.stub.ServerCalls.asyncUnaryCall(
            new MethodHandlers<
              com.demo.insurance.fraudgrpc.FraudRequest,
              com.demo.insurance.fraudgrpc.FraudReply>(
                service, METHODID_ANALYZE)))
        .build();
  }

  private static abstract class FraudDetectionServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    FraudDetectionServiceBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return com.demo.insurance.fraudgrpc.FraudProto.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("FraudDetectionService");
    }
  }

  private static final class FraudDetectionServiceFileDescriptorSupplier
      extends FraudDetectionServiceBaseDescriptorSupplier {
    FraudDetectionServiceFileDescriptorSupplier() {}
  }

  private static final class FraudDetectionServiceMethodDescriptorSupplier
      extends FraudDetectionServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final java.lang.String methodName;

    FraudDetectionServiceMethodDescriptorSupplier(java.lang.String methodName) {
      this.methodName = methodName;
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.MethodDescriptor getMethodDescriptor() {
      return getServiceDescriptor().findMethodByName(methodName);
    }
  }

  private static volatile io.grpc.ServiceDescriptor serviceDescriptor;

  public static io.grpc.ServiceDescriptor getServiceDescriptor() {
    io.grpc.ServiceDescriptor result = serviceDescriptor;
    if (result == null) {
      synchronized (FraudDetectionServiceGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new FraudDetectionServiceFileDescriptorSupplier())
              .addMethod(getAnalyzeMethod())
              .build();
        }
      }
    }
    return result;
  }
}
