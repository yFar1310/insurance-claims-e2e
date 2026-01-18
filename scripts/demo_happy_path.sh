#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:8084"

echo "== Start workflow (happy path) =="
RESP=$(curl -s -X POST "$BASE/api/workflow/start" \
  -H 'Content-Type: application/json' \
  -d '{
    "customerId":"CUST-1",
    "fullName":"Yahya Farehan",
    "policyNumber":"P-1001",
    "claimType":"ACCIDENT",
    "claimedAmount":2500,
    "description":"Broken screen"
  }')

echo "$RESP"

CLAIM_ID=$(echo "$RESP" | sed -n 's/.*"businessKey":"\([^"]*\)".*/\1/p')
PID=$(echo "$RESP" | sed -n 's/.*"processInstanceId":"\([^"]*\)".*/\1/p')

echo "claimId=$CLAIM_ID"
echo "pid=$PID"

echo "== Fetch tasks =="
TASKS=$(curl -s "$BASE/api/workflow/claims/$CLAIM_ID/tasks")
echo "$TASKS"

DOC_TASK_ID=$(echo "$TASKS" | sed -n 's/.*"taskDefinitionKey":"ut_docs".*"id":"\([^"]*\)".*/\1/p')
if [ -z "${DOC_TASK_ID}" ]; then
  echo "ERROR: Could not find ut_docs task"
  exit 1
fi

echo "== Complete Document Review (docsOk=true) =="
curl -s -X POST "$BASE/api/workflow/tasks/$DOC_TASK_ID/complete" \
  -H 'Content-Type: application/json' \
  -d '{"docsOk": true, "comment":"All documents provided"}'
echo

echo "== Fetch tasks after docs =="
TASKS2=$(curl -s "$BASE/api/workflow/claims/$CLAIM_ID/tasks")
echo "$TASKS2"

EXPERT_TASK_ID=$(echo "$TASKS2" | sed -n 's/.*"taskDefinitionKey":"ut_expert".*"id":"\([^"]*\)".*/\1/p')
if [ -z "${EXPERT_TASK_ID}" ]; then
  echo "ERROR: Could not find ut_expert task"
  exit 1
fi

echo "== Complete Expert Assessment (expertApproved=true) =="
curl -s -X POST "$BASE/api/workflow/tasks/$EXPERT_TASK_ID/complete" \
  -H 'Content-Type: application/json' \
  -d '{
    "expertOk": true,
    "expertApproved": true,
    "expertDecision": "APPROVE",
    "comment": "Approve"
  }'
echo

echo "== Final State =="
curl -s "$BASE/api/workflow/claims/$CLAIM_ID/state"; echo

echo "== Final History =="
curl -s "$BASE/api/workflow/claims/$CLAIM_ID/history"; echo
