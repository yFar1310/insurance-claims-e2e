package com.demo.insurance.identitysoap;

import jakarta.jws.WebMethod;
import jakarta.jws.WebParam;
import jakarta.jws.WebService;

@WebService(serviceName = "IdentityVerificationService")
public class IdentityVerificationService {

  @WebMethod
  public VerificationResult verifyIdentity(
      @WebParam(name = "customerId") String customerId,
      @WebParam(name = "fullName") String fullName,
      @WebParam(name = "policyNumber") String policyNumber
  ) {
    // SIMULATION RULE (demo-friendly):
    // - if policyNumber ends with "0" => fail
    // - else verified
    boolean ok = policyNumber != null && !policyNumber.trim().endsWith("0");

    VerificationResult res = new VerificationResult();
    res.verified = ok;
    res.reason = ok ? "IDENTITY_VERIFIED" : "IDENTITY_VERIFICATION_FAILED";
    return res;
  }
}
