#!/usr/bin/env bash
set -euo pipefail

ts="$(date +"%Y-%m-%d_%H-%M-%S")"
out="proofs/run_${ts}.txt"

{
  echo "=== DEMO RUN @ $ts ==="
  echo "--- smoke ---"
  ./scripts/smoke.sh
  echo
  echo "--- happy path ---"
  ./scripts/demo_happy_path.sh
  echo
  echo "--- suspend missing docs ---"
  ./scripts/demo_suspend_missing_docs.sh
  echo
  echo "--- reject not covered (GraphQL) ---"
  ./scripts/demo_reject_not_covered.sh
  echo
  echo "--- reject fraud auto (gRPC) ---"
  ./scripts/demo_reject_fraud_auto.sh
  echo
  echo "--- reject identity (SOAP) ---"
  ./scripts/demo_reject_identity.sh
  echo
} | tee "$out"

echo "Saved proof to: $out"
