#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:8084"

echo "== Start workflow (not covered via GraphQL limit) =="
RESP=$(curl -s -X POST "$BASE/api/workflow/start" \
  -H 'Content-Type: application/json' \
  -d '{
    "customerId":"CUST-3",
    "fullName":"Test User",
    "policyNumber":"P-1999",
    "claimType":"ACCIDENT",
    "claimedAmount":2500,
    "description":"Policy limit exceeded (ends with 999)"
  }')

echo "$RESP"
CLAIM_ID=$(echo "$RESP" | sed -n 's/.*"businessKey":"\([^"]*\)".*/\1/p')
echo "claimId=$CLAIM_ID"

echo "== State =="
curl -s "$BASE/api/workflow/claims/$CLAIM_ID/state"; echo

echo "== History (expect REJECTED: Policy does not cover this claim) =="
curl -s "$BASE/api/workflow/claims/$CLAIM_ID/history"; echo
