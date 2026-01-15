package com.demo.insurance.claimrest.service;

import com.demo.insurance.claimrest.model.*;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

@Service
public class ClaimStore {

  private final Map<String, Claim> claims = new ConcurrentHashMap<>();

  public Claim create(ClaimSubmissionRequest req) {
    String id = "CLM-" + UUID.randomUUID().toString().substring(0, 8);

    Claim c = new Claim();
    c.id = id;
    c.customerId = req.customerId;
    c.fullName = req.fullName;
    c.policyNumber = req.policyNumber;
    c.claimType = req.claimType;
    c.claimedAmount = req.claimedAmount;
    c.description = req.description;

    c.createdAt = Instant.now();
    c.status = ClaimStatus.SUBMITTED;
    c.history.add(new ClaimHistoryEvent(Instant.now(), ClaimStatus.SUBMITTED, "Claim submitted"));

    claims.put(id, c);
    return c;
  }

  public Optional<Claim> get(String id) {
    return Optional.ofNullable(claims.get(id));
  }

  public List<Claim> list() {
    var out = new ArrayList<>(claims.values());
    out.sort(Comparator.comparing((Claim c) -> c.createdAt).reversed());
    return out;
  }

  public List<ClaimHistoryEvent> history(String id) {
    Claim c = claims.get(id);
    if (c == null) return List.of();
    return c.history;
  }

  // later: used by workflow-engine to push updates
  public Optional<Claim> updateStatus(String id, ClaimStatus status, String message) {
    Claim c = claims.get(id);
    if (c == null) return Optional.empty();
    c.status = status;
    c.history.add(new ClaimHistoryEvent(Instant.now(), status, message));
    return Optional.of(c);
  }

}
