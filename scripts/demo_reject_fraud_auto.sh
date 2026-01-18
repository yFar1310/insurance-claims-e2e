#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:8084"

echo "== Start workflow (fraud auto-reject: THEFT + amount>3000 => HIGH) =="
RESP=$(curl -s -X POST "$BASE/api/workflow/start" \
  -H 'Content-Type: application/json' \
  -d '{
    "customerId":"CUST-4",
    "fullName":"Test User",
    "policyNumber":"P-1001",
    "claimType":"THEFT",
    "claimedAmount":4000,
    "description":"Force HIGH fraud risk + amount>3000"
  }')

echo "$RESP"
CLAIM_ID=$(echo "$RESP" | sed -n 's/.*"businessKey":"\([^"]*\)".*/\1/p')
echo "claimId=$CLAIM_ID"

echo "== State =="
curl -s "$BASE/api/workflow/claims/$CLAIM_ID/state"; echo

echo "== History (expect REJECTED: High fraud risk and amount above threshold) =="
curl -s "$BASE/api/workflow/claims/$CLAIM_ID/history"; echo
