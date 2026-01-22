package com.demo.insurance.workflowclean.api;

import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import com.demo.insurance.workflowclean.tasks.AppConfig;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/workflow")
@CrossOrigin(origins = "*")
public class WorkflowApiController {

  private final RuntimeService runtimeService;
  private final TaskService taskService;
  private final AppConfig cfg;
  private final RestTemplate http = new RestTemplate();

  public WorkflowApiController(RuntimeService runtimeService, TaskService taskService, AppConfig cfg) {
    this.runtimeService = runtimeService;
    this.taskService = taskService;
    this.cfg = cfg;
  }

  @GetMapping("/ping")
  public Map<String, Object> ping() {
    return Map.of("ok", true, "ts", Instant.now().toString());
  }

  public static class StartRequest {
    public String customerId;
    public String fullName;
    public String policyNumber;
    public String claimType;
    public Double claimedAmount;
    public String description;
  }

  @PostMapping("/start")
  public Map<String, Object> start(@RequestBody StartRequest req) {
    if (req.claimedAmount == null) req.claimedAmount = 0.0;

    Map<String, Object> vars = new HashMap<>();
    vars.put("customerId", req.customerId);
    vars.put("fullName", req.fullName);
    vars.put("policyNumber", req.policyNumber);
    vars.put("claimType", req.claimType);
    vars.put("claimedAmount", req.claimedAmount);
    vars.put("description", req.description);

    // We will create the claim INSIDE the workflow (first service task)
    ProcessInstance pi = runtimeService.startProcessInstanceByKey("claimProcess", vars);

    ProcessInstance refreshed = runtimeService.createProcessInstanceQuery()
   .processInstanceId(pi.getId())
   .singleResult();

   String businessKey = refreshed != null ? refreshed.getBusinessKey() : pi.getBusinessKey();

   return Map.of("processInstanceId", pi.getId(), "businessKey", businessKey);
  }

  @GetMapping("/claims/{claimId}/tasks")
  public List<Map<String, Object>> tasks(@PathVariable("claimId") String claimId) {
    List<Task> tasks = taskService.createTaskQuery()
      .processInstanceBusinessKey(claimId)
      .active()
      .list();

    List<Map<String, Object>> out = new ArrayList<>();
    for (Task t : tasks) {
      out.add(Map.of(
        "id", t.getId(),
        "name", t.getName(),
        "taskDefinitionKey", t.getTaskDefinitionKey()
      ));
    }
    return out;
  }



  @PostMapping("/tasks/{taskId}/complete")
  public Map<String, Object> complete(
    @PathVariable("taskId") String taskId,
    @RequestBody(required = false) Map<String, Object> variables
  ) {
    taskService.complete(taskId, variables == null ? Map.of() : variables);
    return Map.of("ok", true);
  }

  @GetMapping("/claims/{claimId}/state")
public Map<String, Object> state(@PathVariable("claimId") String claimId) {
  ProcessInstance pi = runtimeService.createProcessInstanceQuery()
    .processInstanceBusinessKey(claimId)
    .singleResult();

  if (pi == null) {
    return Map.of("claimId", claimId, "state", "FINISHED");
  }
  return Map.of(
    "claimId", claimId,
    "state", "RUNNING",
    "processInstanceId", pi.getId(),
    "activityId", runtimeService.getActiveActivityIds(pi.getId())
  );
}
@GetMapping("/claims/{claimId}")
  public Object claim(@PathVariable("claimId") String claimId) {
    return http.getForObject(cfg.getClaimBaseUrl() + "/claims/" + claimId, Object.class);
  }

  @GetMapping("/claims/{claimId}/history")
  public Object history(@PathVariable("claimId") String claimId) {
    return http.getForObject(cfg.getClaimBaseUrl() + "/claims/" + claimId + "/history", Object.class);
  }
  @GetMapping("/instances/{processInstanceId}/tasks")
  public List<Map<String, Object>> tasksByInstance(
    @PathVariable("processInstanceId") String processInstanceId
  ) {
    List<Task> tasks = taskService.createTaskQuery()
      .processInstanceId(processInstanceId)
      .active()
      .list();
  
    List<Map<String, Object>> out = new ArrayList<>();
    for (Task t : tasks) {
      out.add(Map.of(
        "id", t.getId(),
        "name", t.getName(),
        "taskDefinitionKey", t.getTaskDefinitionKey()
      ));
    }
    return out;
  }

  @GetMapping("/tasks/active")
public List<Map<String, Object>> activeTasks() {
  List<Task> tasks = taskService.createTaskQuery().active().list();

  List<Map<String, Object>> out = new ArrayList<>();
  for (Task t : tasks) {
    ProcessInstance pi = runtimeService.createProcessInstanceQuery()
      .processInstanceId(t.getProcessInstanceId())
      .singleResult();

    String claimId = (pi != null) ? pi.getBusinessKey() : null;

    out.add(Map.of(
      "id", t.getId(),
      "name", t.getName(),
      "taskDefinitionKey", t.getTaskDefinitionKey(),
      "processInstanceId", t.getProcessInstanceId(),
      "claimId", claimId
    ));
  }
  return out;
}
}
