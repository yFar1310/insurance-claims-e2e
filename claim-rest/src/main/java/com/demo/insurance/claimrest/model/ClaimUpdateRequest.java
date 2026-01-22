package com.demo.insurance.claimrest.model;

import java.math.BigDecimal;

public record ClaimUpdateRequest(
    String customerId,
    String fullName,
    String policyNumber,
    ClaimType claimType,
    BigDecimal claimedAmount,
    String description
) {}
