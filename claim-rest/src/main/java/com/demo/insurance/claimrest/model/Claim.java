package com.demo.insurance.claimrest.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class Claim {
  public String id;

  public String customerId;
  public String fullName;
  public String policyNumber;
  public ClaimType claimType;
  public BigDecimal claimedAmount;
  public String description;

  public ClaimStatus status;
  public Instant createdAt;

  public List<ClaimHistoryEvent> history = new ArrayList<>();
}
