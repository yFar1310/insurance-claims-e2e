#!/usr/bin/env bash
set -euo pipefail

echo "== Health checks =="
curl -s http://localhost:8081/health | head -c 200; echo
curl -s http://localhost:8084/api/workflow/ping; echo

echo "== Start workflow (happy-ish) =="
RESP=$(curl -s -X POST http://localhost:8084/api/workflow/start \
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

# In your API, claim id is returned as businessKey (e.g., CLM-xxxx)
CLAIM_ID=$(echo "$RESP" | sed -n 's/.*"businessKey":"\([^"]*\)".*/\1/p')
PID=$(echo "$RESP" | sed -n 's/.*"processInstanceId":"\([^"]*\)".*/\1/p')

if [ -z "${CLAIM_ID}" ]; then
  echo "ERROR: Could not parse businessKey from response"
  exit 1
fi

echo "claimId=$CLAIM_ID"
echo "processInstanceId=$PID"

echo "== State =="
curl -s "http://localhost:8084/api/workflow/claims/$CLAIM_ID/state"; echo

echo "== History =="
curl -s "http://localhost:8084/api/workflow/claims/$CLAIM_ID/history"; echo

echo "== Tasks (if any) =="
curl -s "http://localhost:8084/api/workflow/claims/$CLAIM_ID/tasks"; echo