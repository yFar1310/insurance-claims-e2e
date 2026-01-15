package com.demo.insurance.policygraphql;

public record Policy(
    String policyNumber,
    boolean valid,
    String holderName,
    double coverageLimit
) {}
