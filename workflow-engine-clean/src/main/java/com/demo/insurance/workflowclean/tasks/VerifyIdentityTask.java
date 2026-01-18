package com.demo.insurance.workflowclean.tasks;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component("verifyIdentityTask")
public class VerifyIdentityTask implements JavaDelegate {

  private final AppConfig cfg;
  private final RestTemplate http = new RestTemplate();

  public VerifyIdentityTask(AppConfig cfg) {
    this.cfg = cfg;
  }

  @Override
  public void execute(DelegateExecution ex) {
    String customerId = String.valueOf(ex.getVariable("customerId"));
    String fullName = String.valueOf(ex.getVariable("fullName"));
    String policyNumber = String.valueOf(ex.getVariable("policyNumber"));

    String soapBody =
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
      + "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" "
      + "xmlns:tns=\"http://identitysoap.insurance.demo.com/\">"
      + "<soapenv:Header/>"
      + "<soapenv:Body>"
      + "<tns:verifyIdentity>"
      + "<customerId>" + escape(customerId) + "</customerId>"
      + "<fullName>" + escape(fullName) + "</fullName>"
      + "<policyNumber>" + escape(policyNumber) + "</policyNumber>"
      + "</tns:verifyIdentity>"
      + "</soapenv:Body>"
      + "</soapenv:Envelope>";

    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.TEXT_XML);

    String url = cfg.getSoapIdentityUrl(); // http://localhost:8082/ws/identity
    ResponseEntity<String> res = http.exchange(url, HttpMethod.POST, new HttpEntity<>(soapBody, headers), String.class);

    String xml = res.getBody() == null ? "" : res.getBody();
    boolean verified = xml.contains(">true<") && (xml.toLowerCase().contains("verified") || xml.toLowerCase().contains("verify"));

    // safer parsing: accept <verified>true</verified> OR <isVerified>true</isVerified>
    verified = verified || xml.matches("(?s).*<(verified|isVerified)>true</(verified|isVerified)>.*");

    ex.setVariable("identityOk", verified);
  }

  private String escape(String s) {
    return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
  }
}
