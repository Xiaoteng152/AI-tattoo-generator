#!/usr/bin/env bash
# Fixture ingest against a deployed API. Does NOT call Grok.
# Usage:
#   export GROK_RADAR_API_URL="https://your-domain.com/api/trading-radar"
#   export GROK_INGEST_SECRET="same-as-vercel"
#   ./ops/grok-radar/scripts/fixture-ingest.sh

set -euo pipefail

API_URL="${GROK_RADAR_API_URL:?set GROK_RADAR_API_URL}"
SECRET="${GROK_INGEST_SECRET:?set GROK_INGEST_SECRET}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESULT_TEMPLATE="$ROOT/fixtures/sample-result.json"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

if [[ ${#SECRET} -lt 32 ]]; then
  echo "GROK_INGEST_SECRET must be at least 32 characters" >&2
  exit 1
fi

sign() {
  local ts="$1"
  local body_file="$2"
  python3 - "$SECRET" "$ts" "$body_file" <<'PY'
import hashlib, hmac, sys
secret, ts, path = sys.argv[1], sys.argv[2], sys.argv[3]
body = open(path, "rb").read()
print("sha256=" + hmac.new(secret.encode(), ts.encode() + b"\n" + body, hashlib.sha256).hexdigest())
PY
}

RUN_ID="fixture-$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4)"
TS="$(date +%s)"
printf '{"runId":"%s"}' "$RUN_ID" >"$WORKDIR/reserve.json"

echo "==> reserve $RUN_ID"
curl -sS -X POST "$API_URL/grok-runs/reserve" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -H "X-Grok-Timestamp: $TS" \
  --data-binary @"$WORKDIR/reserve.json" | tee "$WORKDIR/reserve-resp.json" | python3 -m json.tool

python3 - "$WORKDIR/reserve-resp.json" "$RESULT_TEMPLATE" "$RUN_ID" "$WORKDIR/ingest.json" <<'PY'
import json, sys
from datetime import datetime

reserve = json.loads(open(sys.argv[1]).read())
template = json.loads(open(sys.argv[2]).read())
run_id = sys.argv[3]
out = sys.argv[4]

if "error" in reserve and "runId" not in reserve and "accounts" not in reserve:
    raise SystemExit(f"reserve failed: {reserve}")

since = datetime.fromisoformat(reserve["window"]["since"].replace("Z", "+00:00"))
until = datetime.fromisoformat(reserve["window"]["until"].replace("Z", "+00:00"))
mid = since + (until - since) / 2
account = reserve["accounts"][0]

finding = template["result"]["findings"][0]
finding["creatorHandle"] = account
finding["url"] = f"https://x.com/{account}/status/2079586556814164073"
finding["publishedAt"] = mid.isoformat().replace("+00:00", "Z")

payload = {
    "run": {
        "id": run_id,
        "model": reserve["model"],
        "reasoningEffort": reserve["reasoningEffort"],
        "accounts": reserve["accounts"],
        "keywords": reserve["keywords"],
        "window": reserve["window"],
        "strategyVersion": reserve["strategy"]["version"],
    },
    "result": template["result"],
    "usage": template["usage"],
    "stderr": template["stderr"],
    "exitCode": template["exitCode"],
    "raw": template["raw"],
}
open(out, "w", encoding="utf-8").write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
PY

echo "==> ingest $RUN_ID"
SIG="$(sign "$TS" "$WORKDIR/ingest.json")"
curl -sS -X POST "$API_URL/grok-ingest" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -H "X-Grok-Timestamp: $TS" \
  -H "X-Grok-Signature: $SIG" \
  -H "Idempotency-Key: $RUN_ID" \
  --data-binary @"$WORKDIR/ingest.json" | tee "$WORKDIR/ingest-resp.json" | python3 -m json.tool

echo "==> re-ingest same runId (should be idempotent)"
TS2="$(date +%s)"
SIG2="$(sign "$TS2" "$WORKDIR/ingest.json")"
curl -sS -X POST "$API_URL/grok-ingest" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -H "X-Grok-Timestamp: $TS2" \
  -H "X-Grok-Signature: $SIG2" \
  -H "Idempotency-Key: $RUN_ID" \
  --data-binary @"$WORKDIR/ingest.json" | python3 -m json.tool

echo "Done. Open /trading-radar and confirm the fixture post + digest."
