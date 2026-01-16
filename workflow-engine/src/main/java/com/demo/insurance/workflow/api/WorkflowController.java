package com.demo.insurance.workflow.api;

import org.flowable.engine.RuntimeService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/workflow")
public class WorkflowController {

  private final RuntimeService runtimeService;

  public WorkflowController(RuntimeService runtimeService) {
    this.runtimeService = runtimeService;
  }

  @PostMapping("/start/{claimId}")
  public Map<String, Object> start(
      @PathVariable("claimId") String claimId,
      @RequestBody(required = false) Map<String, Object> body
  ) {
    Map<String, Object> vars = new HashMap<>();
    vars.put("claimId", claimId);

    if (body != null) vars.putAll(body);

    var pi = runtimeService.startProcessInstanceByKey("claimProcess", vars);

    return Map.of(
        "processInstanceId", pi.getId(),
        "processDefinitionId", pi.getProcessDefinitionId(),
        "claimId", claimId
    );
  }
}
