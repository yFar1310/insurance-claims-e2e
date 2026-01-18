#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:8084"

echo "== Start workflow (docs missing -> suspended) =="
RESP=$(curl -s -X POST "$BASE/api/workflow/start" \
  -H 'Content-Type: application/json' \
  -d '{
    "customerId":"CUST-2",
    "fullName":"Test User",
    "policyNumber":"P-1001",
    "claimType":"ACCIDENT",
    "claimedAmount":2500,
    "description":"Missing documents case"
  }')

echo "$RESP"
CLAIM_ID=$(echo "$RESP" | sed -n 's/.*"businessKey":"\([^"]*\)".*/\1/p')
echo "claimId=$CLAIM_ID"

echo "== Get tasks =="
TASKS=$(curl -s "$BASE/api/workflow/claims/$CLAIM_ID/tasks")
echo "$TASKS"

DOC_TASK_ID=$(echo "$TASKS" | sed -n 's/.*"taskDefinitionKey":"ut_docs".*"id":"\([^"]*\)".*/\1/p')
if [ -z "${DOC_TASK_ID}" ]; then
  echo "ERROR: Could not find ut_docs task"
  exit 1
fi

echo "== Complete docs with docsOk=false =="
curl -s -X POST "$BASE/api/workflow/tasks/$DOC_TASK_ID/complete" \
  -H 'Content-Type: application/json' \
  -d '{"docsOk": false, "comment":"Customer did not provide required docs"}'
echo

echo "== State (should be SUSPENDED) =="
curl -s "$BASE/api/workflow/claims/$CLAIM_ID/state"; echo

echo "== History =="
curl -s "$BASE/api/workflow/claims/$CLAIM_ID/history"; echo
