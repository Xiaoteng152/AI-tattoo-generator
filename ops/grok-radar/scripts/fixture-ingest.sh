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

if [[ ${#SECRET} -lt 32 ]]; then
  echo "GROK_INGEST_SECRET must be at least 32 characters" >&2
  exit 1
fi

RUN_ID="fixture-$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4)"
TS="$(date +%s)"
RESERVE_BODY="$(printf '{"runId":"%s"}' "$RUN_ID")"

echo "==> reserve $RUN_ID"
RESERVE_RESP="$(curl -sS -X POST "$API_URL/grok-runs/reserve" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -H "X-Grok-Timestamp: $TS" \
  -d "$RESERVE_BODY")"

echo "$RESERVE_RESP" | python3 -m json.tool

SINCE="$(echo "$RESERVE_RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["window"]["since"])')"
UNTIL="$(echo "$RESERVE_RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["window"]["until"])')"
ACCOUNT="$(echo "$RESERVE_RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["accounts"][0])')"
MODEL="$(echo "$RESERVE_RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["model"])')"
EFFORT="$(echo "$RESERVE_RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["reasoningEffort"])')"
KEYWORDS="$(echo "$RESERVE_RESP" | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)["keywords"]))')"
ACCOUNTS="$(echo "$RESERVE_RESP" | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)["accounts"]))')"
STRATEGY_VERSION="$(echo "$RESERVE_RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["strategy"]["version"])')"
WINDOW="$(echo "$RESERVE_RESP" | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)["window"]))')"

MIDPOINT="$(python3 - <<PY
from datetime import datetime, timezone
since=datetime.fromisoformat("$SINCE".replace("Z","+00:00"))
until=datetime.fromisoformat("$UNTIL".replace("Z","+00:00"))
mid=since + (until-since)/2
print(mid.isoformat().replace("+00:00","Z"))
PY
)"

INGEST_BODY="$(python3 - <<PY
import json
from pathlib import Path
template=json.loads(Path("$RESULT_TEMPLATE").read_text())
finding=template["result"]["findings"][0]
finding["creatorHandle"]="$ACCOUNT"
finding["url"]=f"https://x.com/$ACCOUNT/status/2079586556814164073"
finding["publishedAt"]="$MIDPOINT"
payload={
  "run": {
    "id": "$RUN_ID",
    "model": "$MODEL",
    "reasoningEffort": "$EFFORT",
    "accounts": json.loads('''$ACCOUNTS'''),
    "keywords": json.loads('''$KEYWORDS'''),
    "window": json.loads('''$WINDOW'''),
    "strategyVersion": int("$STRATEGY_VERSION"),
  },
  "result": template["result"],
  "usage": template["usage"],
  "stderr": template["stderr"],
  "exitCode": template["exitCode"],
  "raw": template["raw"],
}
print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
PY
)"

SIG="$(python3 - <<PY
import hmac, hashlib, os
secret=os.environ["GROK_INGEST_SECRET"]
ts="$TS"
body='''$INGEST_BODY'''
print("sha256=" + hmac.new(secret.encode(), f"{ts}\\n{body}".encode(), hashlib.sha256).hexdigest())
PY
)"

echo "==> ingest $RUN_ID"
INGEST_RESP="$(curl -sS -X POST "$API_URL/grok-ingest" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -H "X-Grok-Timestamp: $TS" \
  -H "X-Grok-Signature: $SIG" \
  -H "Idempotency-Key: $RUN_ID" \
  -d "$INGEST_BODY")"

echo "$INGEST_RESP" | python3 -m json.tool

echo "==> re-ingest same runId (should be idempotent)"
TS2="$(date +%s)"
SIG2="$(python3 - <<PY
import hmac, hashlib, os
secret=os.environ["GROK_INGEST_SECRET"]
ts="$TS2"
body='''$INGEST_BODY'''
print("sha256=" + hmac.new(secret.encode(), f"{ts}\\n{body}".encode(), hashlib.sha256).hexdigest())
PY
)"
curl -sS -X POST "$API_URL/grok-ingest" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -H "X-Grok-Timestamp: $TS2" \
  -H "X-Grok-Signature: $SIG2" \
  -H "Idempotency-Key: $RUN_ID" \
  -d "$INGEST_BODY" | python3 -m json.tool

echo "Done. Open /trading-radar and confirm the fixture post + digest."
