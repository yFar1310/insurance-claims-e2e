package com.demo.insurance.identitysoap;

import jakarta.xml.bind.annotation.XmlAccessType;
import jakarta.xml.bind.annotation.XmlAccessorType;
import jakarta.xml.bind.annotation.XmlType;

@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "VerificationResult")
public class VerificationResult {
  public boolean verified;
  public String reason;
}
