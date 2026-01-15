package com.demo.insurance.workflow.api;

import org.flowable.engine.RuntimeService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/workflow")
public class WorkflowController {

  private final RuntimeService runtime;

  public WorkflowController(RuntimeService runtime) {
    this.runtime = runtime;
  }

  @PostMapping("/start/{claimId}")
  public Map<String, Object> start(@PathVariable("claimId") String claimId, @RequestBody Map<String, Object> payload) {
    // payload must contain: policyNumber, customerId, fullName, claimType, claimedAmount
    var vars = new java.util.HashMap<String, Object>(payload);
    vars.put("claimId", claimId);

    var pi = runtime.startProcessInstanceByKey("claimProcess", vars);

    return Map.of(
        "processInstanceId", pi.getId(),
        "claimId", claimId,
        "status", "STARTED"
    );
  }
}
