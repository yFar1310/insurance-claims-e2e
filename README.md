# End-to-End Insurance Claim Processing (Flowable + Microservices)

**Author:** Yahya Farehan  
**Course project:** End-to-End Insurance Claim Processing  
**Tech stack:** Flowable (BPMN), Spring Boot, REST, SOAP, GraphQL, gRPC, Swagger/OpenAPI, Bash/curl scripts

---

## 1) Overview

This project simulates an insurance company digital claim service where a BPMN workflow orchestrates multiple partner services to submit, verify, evaluate, and finalize insurance claims.

All partner interactions and payments are **simulated**, as required.

---

## 2) Workflow Summary

Main steps:

1. **Claim Submission (REST)** — create a claim in `claim-rest`
2. **Identity Verification (SOAP)** — reject on failure
3. **Policy Validation (GraphQL)** — stop if not covered (limit rules)
4. **Fraud Detection (gRPC)** — produces a risk level (LOW/MEDIUM/HIGH)
5. **Eligibility/Rules** — auto-reject if `HIGH` and amount > threshold
6. **Document Review (User Task)** — approve docs or suspend
7. **Expert Assessment (User Task)** — approve/reject
8. **Compensation + Payment Authorization (simulated)** — finalize
9. **Customer Notification + Tracking** — status/history endpoints

> BPMN pools/message flows are provided via Flowable UI screenshots (see `proofs/`).

---

## 3) Architecture & Ports

| Service | Protocol | Default Port | Docs |
|---|---:|---:|---|
| `claim-rest` | REST | 8081 | `http://localhost:8081/swagger` |
| `workflow-engine-clean` | REST (Flowable orchestration) | 8084 | `http://localhost:8084/swagger` |
| `identity-soap` | SOAP | 8082 | `http://localhost:8082/ws/identity?wsdl` |
| `policy-graphql` | GraphQL | 8083 | `http://localhost:8083/graphiql` |
| `fraud-grpc` | gRPC | 9090 | proto in `fraud-grpc/src/main/proto/` |

Health checks:
- `claim-rest`: `http://localhost:8081/health`
- `workflow-engine`: `http://localhost:8084/api/workflow/ping`

---

## 4) API Documentation

- Claim REST Swagger: `http://localhost:8081/swagger`
- Workflow Swagger: `http://localhost:8084/swagger`
- Identity SOAP WSDL: `http://localhost:8082/ws/identity?wsdl`
- Policy GraphiQL: `http://localhost:8083/graphiql`

---

## 5) How to Run (Local - Maven)

Open 5 terminals from the repo root:

```bash
mvn -pl claim-rest spring-boot:run
mvn -pl identity-soap spring-boot:run
mvn -pl policy-graphql spring-boot:run
mvn -pl fraud-grpc spring-boot:run
mvn -pl workflow-engine-clean spring-boot:run
```

---

## 6) Automated Tests / Demo Scenarios (Scripts)

Scripts are in `./scripts/` and use `curl` to demonstrate reproducible scenarios.

### Smoke test
Starts a claim and prints state/history/tasks:
```bash
./scripts/smoke.sh
```

### Happy path (Approved + Paid)
```bash
./scripts/demo_happy_path.sh
```

### Missing documents (Suspended)
```bash
./scripts/demo_suspend_missing_docs.sh
```

### Policy not covered (GraphQL)
```bash
./scripts/demo_reject_not_covered.sh
```

### Fraud auto-reject (gRPC HIGH + amount threshold)
```bash
./scripts/demo_reject_fraud_auto.sh
```

### Identity failure (SOAP)
```bash
./scripts/demo_reject_identity.sh
```

### Run all demos + save proof output
```bash
./scripts/run_all_demos.sh
```

Outputs are saved under:
- `./proofs/`

---

## 7) Useful Endpoints (Workflow Engine)

> All endpoints are also documented in Swagger: `http://localhost:8084/swagger`

- Start a workflow:
  - `POST /api/workflow/start`
- Claim tracking:
  - `GET /api/workflow/claims/{claimId}/state`
  - `GET /api/workflow/claims/{claimId}/history`
  - `GET /api/workflow/claims/{claimId}/tasks`
- Complete a user task:
  - `POST /api/workflow/tasks/{taskId}/complete`

---

## 8) Requirements Mapping (Course Rubric)

| Requirement | Proof / Where |
|---|---|
| Workflow with pools + partner interactions | BPMN screenshots in `proofs/` + service tasks calling external services |
| Gateways (XOR/AND/OR) | BPMN model (identity/coverage/fraud/docs/expert) |
| REST resource requested | Claim submission + status updates (claim-rest) |
| SOAP service requested | identity-soap (`/ws/identity?wsdl`) |
| gRPC API requested | fraud-grpc (port 9090 + proto) |
| GraphQL API requested | policy-graphql (`/graphql` + GraphiQL) |
| APIs test & documentation | Swagger UIs + scripts + proof logs |
| Correct procedures & complete execution | Scenarios: APPROVED, REJECTED (identity/policy/fraud), SUSPENDED (docs) |
| Microservices deployment (optional bonus) | (If enabled) Docker Compose instructions & config |

---

## 9) Notes / Project Rules

- All partner services are simulated.
- The project is designed to be presented in ~20 minutes with:
  - BPMN screenshot
  - Swagger + WSDL + GraphiQL
  - Run scripts showing multiple outcomes

---
