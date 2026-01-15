package com.demo.insurance.claimrest.model;

import java.time.Instant;

public class ClaimHistoryEvent {
  public Instant at;
  public ClaimStatus status;
  public String message;

  public ClaimHistoryEvent() {}

  public ClaimHistoryEvent(Instant at, ClaimStatus status, String message) {
    this.at = at;
    this.status = status;
    this.message = message;
  }
}
