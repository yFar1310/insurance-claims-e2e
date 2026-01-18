package com.demo.insurance.workflowclean.tasks;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app")
public class AppConfig {

  private String claimBaseUrl;
  private String soapIdentityUrl;
  private String graphqlUrl;
  private String grpcHost;
  private int grpcPort;

  public String getClaimBaseUrl() { return claimBaseUrl; }
  public void setClaimBaseUrl(String claimBaseUrl) { this.claimBaseUrl = claimBaseUrl; }

  public String getSoapIdentityUrl() { return soapIdentityUrl; }
  public void setSoapIdentityUrl(String soapIdentityUrl) { this.soapIdentityUrl = soapIdentityUrl; }

  public String getGraphqlUrl() { return graphqlUrl; }
  public void setGraphqlUrl(String graphqlUrl) { this.graphqlUrl = graphqlUrl; }

  public String getGrpcHost() { return grpcHost; }
  public void setGrpcHost(String grpcHost) { this.grpcHost = grpcHost; }

  public int getGrpcPort() { return grpcPort; }
  public void setGrpcPort(int grpcPort) { this.grpcPort = grpcPort; }
}
