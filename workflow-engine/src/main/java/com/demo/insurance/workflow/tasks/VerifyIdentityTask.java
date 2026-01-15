package com.demo.insurance.workflow.tasks;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.springframework.stereotype.Component;

import jakarta.xml.ws.Service;
import javax.xml.namespace.QName;
import java.net.URL;

@Component("verifyIdentityTask")
public class VerifyIdentityTask implements JavaDelegate {

  @Override
  public void execute(DelegateExecution execution) {
    try{
    String claimId = (String) execution.getVariable("claimId");
    String policyNumber = (String) execution.getVariable("policyNumber");
    String customerId = (String) execution.getVariable("customerId");
    String fullName = (String) execution.getVariable("fullName");

    URL wsdl = new URL("http://localhost:8081/ws/identity?wsdl");
    QName serviceName = new QName("http://identitysoap.insurance.demo.com/", "IdentityVerificationService");
    Service svc = Service.create(wsdl, serviceName);

    // Port name from WSDL can vary; easiest is dynamic by interface:
    IdentityVerificationService port = svc.getPort(IdentityVerificationService.class);

    VerificationResult res = port.verifyIdentity(customerId, fullName, policyNumber);

    execution.setVariable("identityOk", res.isVerified());
  }
    catch (Exception e) {
      throw new RuntimeException("SOAP identity verification failed", e);
    }
  }

  // local interface matching the SOAP service (JAX-WS dynamic proxy)
  @jakarta.jws.WebService(targetNamespace = "http://identitysoap.insurance.demo.com/",
      name = "IdentityVerificationService")
  public interface IdentityVerificationService {
    VerificationResult verifyIdentity(String customerId, String fullName, String policyNumber);
  }

  public static class VerificationResult {
    private boolean verified;
    private String reason;

    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
  }
}
