#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:8084"

echo "== Start workflow (identity fail: policy ends with 0) =="
RESP=$(curl -s -X POST "$BASE/api/workflow/start" \
  -H 'Content-Type: application/json' \
  -d '{
    "customerId":"CUST-FAIL",
    "fullName":"Test User",
    "policyNumber":"P-1000",
    "claimType":"ACCIDENT",
    "claimedAmount":2500,
    "description":"Identity should fail because policy ends with 0"
  }')

echo "$RESP"
CLAIM_ID=$(echo "$RESP" | sed -n 's/.*"businessKey":"\([^"]*\)".*/\1/p')
echo "claimId=$CLAIM_ID"

echo "== State =="
curl -s "$BASE/api/workflow/claims/$CLAIM_ID/state"; echo

echo "== History (expect REJECTED: Identity verification failed) =="
curl -s "$BASE/api/workflow/claims/$CLAIM_ID/history"; echo
