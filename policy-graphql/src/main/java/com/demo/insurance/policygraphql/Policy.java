package com.demo.insurance.policygraphql;
import java.util.List;

public record Policy(
    String policyNumber,
    boolean valid,
    String holderName,
    double coverageLimit,
    List<String> coveredClaimTypes,
    String notes
) {}
