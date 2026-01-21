package com.demo.insurance.policygraphql;

import java.util.*;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

@Controller
public class PolicyQuery {

  private static final Map<String, Policy> POLICIES = new LinkedHashMap<>();

  static {
    POLICIES.put("P-1001", new Policy(
      "P-1001", true, "John Doe", 5000.0,
      List.of("ACCIDENT", "FIRE", "HEALTH", "THEFT", "OTHER"),
      "Standard policy (happy path demo)."
    ));

    POLICIES.put("P-1006", new Policy(
      "P-1006", true, "John Doe", 5000.0,
      List.of("ACCIDENT", "FIRE", "HEALTH", "OTHER"),
      "Same as P-1001 but THEFT is NOT covered (demo rejection)."
    ));

    POLICIES.put("P-1999", new Policy(
      "P-1999", true, "Jane Smith", 500.0,
      List.of("ACCIDENT", "FIRE"),
      "Low coverage limit (demo LIMIT_EXCEEDED)."
    ));

    POLICIES.put("P-0000", new Policy(
      "P-0000", false, "Unknown", 0.0,
      List.of(),
      "Invalid / expired policy (demo POLICY_INVALID)."
    ));
  }

  private String normalize(String policyNumber) {
    if (policyNumber == null) return "";
    String p = policyNumber.trim().toUpperCase();
    // accept POL-xxxx -> P-xxxx
    if (p.startsWith("POL-")) p = "P-" + p.substring(4);
    return p;
  }

  @QueryMapping
  public List<Policy> policies() {
    return new ArrayList<>(POLICIES.values());
  }

  @QueryMapping
  public Policy policy(@Argument("policyNumber") String policyNumber) {
    String p = normalize(policyNumber);
    Policy found = POLICIES.get(p);
    if (found != null) return found;

    // Unknown policy
    return new Policy(p, false, null, 0.0, List.of(), "Unknown policy number.");
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

    String ct = (claimType == null) ? "" : claimType.trim().toUpperCase();
    double amount = (claimedAmount == null) ? 0.0 : claimedAmount;

    if (!p.coveredClaimTypes().contains(ct)) {
      return new CoverageResult(false, "CLAIM_TYPE_NOT_COVERED", 0.0);
    }

    double maxPayable = Math.min(amount, p.coverageLimit());
    boolean covered = amount <= p.coverageLimit();

    return new CoverageResult(covered, covered ? "COVERED" : "LIMIT_EXCEEDED", maxPayable);
  }
}
