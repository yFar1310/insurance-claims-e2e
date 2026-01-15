package com.demo.insurance.policygraphql;

import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

@Controller
public class PolicyQuery {

  @QueryMapping
  public Policy policy(@Argument("policyNumber") String policyNumber) {
    // Never return null because schema says Policy!
    if (policyNumber == null) policyNumber = "";

    boolean valid = policyNumber.startsWith("POL-");
    double limit = policyNumber.endsWith("999") ? 500.0 : 5000.0;

    return new Policy(policyNumber, valid, "John Doe", limit);
  }

  @QueryMapping
  public CoverageResult covers(
  @Argument("policyNumber") String policyNumber,
  @Argument("claimType") String claimType,
  @Argument("claimedAmount") Double claimedAmount
) {
    Policy p = policy(policyNumber);

    if (!p.valid()) {
      return new CoverageResult(false, "POLICY_INVALID", 0.0);
    }

    String ct = (claimType == null) ? "" : claimType.toUpperCase();
    double amount = (claimedAmount == null) ? 0.0 : claimedAmount;

    // Example rule
    if ("THEFT".equals(ct) && p.policyNumber().endsWith("6")) {
      return new CoverageResult(false, "THEFT_NOT_COVERED", 0.0);
    }

    double maxPayable = Math.min(amount, p.coverageLimit());
    boolean covered = amount <= p.coverageLimit();

    return new CoverageResult(covered, covered ? "COVERED" : "LIMIT_EXCEEDED", maxPayable);
  }
}
