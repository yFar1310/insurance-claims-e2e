package com.demo.insurance.claimrest.api;

import com.demo.insurance.claimrest.model.*;
import com.demo.insurance.claimrest.service.ClaimStore;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/claims")
public class ClaimController {

  private final ClaimStore store;

  public ClaimController(ClaimStore store) {
    this.store = store;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Claim submit(@RequestBody ClaimSubmissionRequest req) {
    // minimal validation (demo-ready)
    if (req == null || req.policyNumber == null || req.policyNumber.isBlank()) {
      throw new BadRequest("policyNumber is required");
    }
    if (req.customerId == null || req.customerId.isBlank()) {
      throw new BadRequest("customerId is required");
    }
    if (req.fullName == null || req.fullName.isBlank()) {
      throw new BadRequest("fullName is required");
    }
    if (req.claimType == null) {
      throw new BadRequest("claimType is required");
    }
    if (req.claimedAmount == null) {
      throw new BadRequest("claimedAmount is required");
    }
    return store.create(req);
  }

  @GetMapping("/{id}")
  public Claim get(@PathVariable("id") String id) {
    return store.get(id).orElseThrow(() -> new NotFound("Claim not found: " + id));
}

  @GetMapping("/{id}/history")
  public List<ClaimHistoryEvent> history(@PathVariable("id") String id) {
     store.get(id).orElseThrow(() -> new NotFound("Claim not found: " + id));
    return store.history(id);
}

  @GetMapping
  public List<Claim> list() {
    return store.list();
  }

  // helper exceptions
  @ResponseStatus(HttpStatus.NOT_FOUND)
  static class NotFound extends RuntimeException {
    NotFound(String msg) { super(msg); }
  }

  @ResponseStatus(HttpStatus.BAD_REQUEST)
  static class BadRequest extends RuntimeException {
    BadRequest(String msg) { super(msg); }
  }

  // clean JSON error body
  @ExceptionHandler({ NotFound.class, BadRequest.class })
  public Map<String, Object> handle(RuntimeException ex) {
    int status = (ex instanceof NotFound) ? 404 : 400;
    return Map.of("status", status, "error", ex.getMessage());
  }
  public record StatusUpdateRequest(String status, String message) {}

@PostMapping("/{id}/status")
public Object updateStatus(
    @PathVariable("id") String id,
    @RequestBody StatusUpdateRequest body
) {
  if (body == null || body.status() == null || body.status().isBlank()) {
    throw new BadRequest("status is required");
  }

  ClaimStatus st;
  try {
    st = ClaimStatus.valueOf(body.status().trim().toUpperCase());
  } catch (Exception e) {
    throw new BadRequest("invalid status: " + body.status());
  }

  var updated = store.updateStatus(id, st, body.message() == null ? "" : body.message());
  return updated.orElseThrow(() -> new NotFound("Claim not found: " + id));
}

@PutMapping("/{id}")
public Claim update(@PathVariable String id, @RequestBody ClaimUpdateRequest body) {
  if (body == null) throw new BadRequest("body is required");
  return store.updateClaim(id, body).orElseThrow(() -> new NotFound("Claim not found: " + id));
}

@DeleteMapping("/{id}")
@ResponseStatus(HttpStatus.NO_CONTENT)
public void delete(@PathVariable String id) {
boolean ok = store.delete(id);
if (!ok) throw new NotFound("Claim not found: " + id);
}
}

