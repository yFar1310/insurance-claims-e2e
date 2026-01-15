package com.demo.insurance.policygraphql;

public record CoverageResult(
    boolean covered,
    String reason,
    double maxPayable
) {}
