package com.demo.insurance.workflowclean.tasks;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Component("policyCoverageTask")
public class PolicyCoverageTask implements JavaDelegate {

  private final AppConfig cfg;
  private final RestTemplate http = new RestTemplate();

  public PolicyCoverageTask(AppConfig cfg) {
    this.cfg = cfg;
  }

  @Override
  public void execute(DelegateExecution ex) {
    String policyNumber = String.valueOf(ex.getVariable("policyNumber"));
    String claimType = String.valueOf(ex.getVariable("claimType"));
    double claimedAmount = Double.parseDouble(String.valueOf(ex.getVariable("claimedAmount")));

    String query = "query($p:String!,$t:String!,$a:Float!){ covers(policyNumber:$p, claimType:$t, claimedAmount:$a){ covered reason maxPayable } }";

    Map<String, Object> vars = new HashMap<>();
    vars.put("p", policyNumber);
    vars.put("t", claimType);
    vars.put("a", claimedAmount);

    Map<String, Object> body = new HashMap<>();
    body.put("query", query);
    body.put("variables", vars);

    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);

    Map res = http.postForObject(cfg.getGraphqlUrl(), new HttpEntity<>(body, headers), Map.class);
    Map data = (Map) res.get("data");
    Map covers = (Map) data.get("covers");

    boolean covered = Boolean.TRUE.equals(covers.get("covered"));
    String reason = String.valueOf(covers.get("reason"));
    double maxPayable = Double.parseDouble(String.valueOf(covers.get("maxPayable")));

    ex.setVariable("covered", covered);
    ex.setVariable("coverReason", reason);
    ex.setVariable("maxPayable", maxPayable);
  }
}
