package com.demo.insurance.claimrest.model;

import java.math.BigDecimal;

public class ClaimSubmissionRequest {
  public String customerId;
  public String fullName;
  public String policyNumber;
  public ClaimType claimType;
  public BigDecimal claimedAmount;
  public String description;
}
