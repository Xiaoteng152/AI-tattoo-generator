#!/usr/bin/env python3
"""Grok Radar VPS collector: reserve → grok-4.5 → validate → HMAC ingest."""

from __future__ import annotations

import fcntl
import hashlib
import hmac
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(os.environ.get("GROK_RADAR_DATA", "/var/lib/grok-radar"))
PROMPT_TEMPLATE = Path(
    os.environ.get("GROK_RADAR_PROMPT", "/opt/grok-radar/prompt.txt")
)
GROK_BIN = os.environ.get("GROK_BIN", "/home/grok-runner/.grok/bin/grok")
TIMEOUT_SECONDS = int(os.environ.get("GROK_RADAR_TIMEOUT", "180"))
API_BASE = os.environ.get("GROK_RADAR_API_URL", "").rstrip("/")
INGEST_SECRET = os.environ.get("GROK_INGEST_SECRET", "")
MODEL = "grok-4.5"
REASONING_EFFORT = "medium"

X_STATUS_RE = re.compile(
    r"^https://(?:www\.)?(?:x\.com|twitter\.com)/([A-Za-z0-9_]{1,15})/status/(\d+)(?:[/?#].*)?$",
    re.IGNORECASE,
)

RESULT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["findings", "digestSummary"],
    "properties": {
        "findings": {
            "type": "array",
            "maxItems": 12,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "creatorHandle",
                    "url",
                    "sourceText",
                    "sourceTextKind",
                    "publishedAt",
                    "language",
                    "postType",
                    "summary",
                    "symbols",
                    "direction",
                    "entryPrice",
                    "entryPriceEvidence",
                    "entryTiming",
                    "entryTimingEvidence",
                    "invalidation",
                    "invalidationEvidence",
                    "strategyMatch",
                    "strategyReason",
                ],
                "properties": {
                    "creatorHandle": {"type": "string"},
                    "url": {"type": "string"},
                    "sourceText": {"type": "string"},
                    "sourceTextKind": {"type": "string"},
                    "publishedAt": {"type": ["string", "null"]},
                    "language": {"type": "string"},
                    "postType": {"type": "string"},
                    "summary": {"type": "string"},
                    "symbols": {"type": "array", "items": {"type": "string"}, "maxItems": 5},
                    "direction": {
                        "type": "string",
                        "enum": ["LONG", "SHORT", "WATCH", "NONE"],
                    },
                    "entryPrice": {"type": "string"},
                    "entryPriceEvidence": {"type": "string"},
                    "entryTiming": {"type": "string"},
                    "entryTimingEvidence": {"type": "string"},
                    "invalidation": {"type": "string"},
                    "invalidationEvidence": {"type": "string"},
                    "strategyMatch": {
                        "type": "string",
                        "enum": ["MATCH", "CONFLICT", "UNKNOWN"],
                    },
                    "strategyReason": {"type": "string"},
                },
            },
        },
        "digestSummary": {
            "type": "array",
            "maxItems": 3,
            "items": {"type": "string"},
        },
    },
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def atomic_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass


def extract_model_payload(text: str) -> dict[str, Any]:
    """Accept the last complete findings object from Grok headless text output."""
    decoder = json.JSONDecoder()
    candidates: list[dict[str, Any]] = []
    position = 0
    while position < len(text):
        while position < len(text) and text[position].isspace():
            position += 1
        if position >= len(text):
            break
        try:
            value, end = decoder.raw_decode(text, position)
        except json.JSONDecodeError:
            next_object = text.find("{", position + 1)
            if next_object < 0:
                break
            position = next_object
            continue
        if isinstance(value, dict) and isinstance(value.get("findings"), list):
            candidates.append(value)
        position = end
    if not candidates:
        raise ValueError("model text does not contain a complete findings object")
    return candidates[-1]


def normalize_evidence(value: str) -> str:
    return re.sub(r"[^a-z0-9\u3400-\u9fff]+", "", value.lower())


def evidence_bound(value: Any, evidence: Any, source_text: str) -> str:
    text = str(value or "").strip() or "未明确"
    if text == "未明确":
        return "未明确"
    excerpt = normalize_evidence(str(evidence or ""))
    if len(excerpt) < 4:
        return "未明确"
    return text if excerpt in normalize_evidence(source_text) else "未明确"


def validate_findings(
    payload: dict[str, Any],
    accounts: list[str],
    window: dict[str, str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    accepted: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    account_set = {item.lstrip("@").lower() for item in accounts}
    since = datetime.fromisoformat(window["since"].replace("Z", "+00:00"))
    until = datetime.fromisoformat(window["until"].replace("Z", "+00:00"))
    seen_ids: set[str] = set()
    per_account: dict[str, int] = {}

    findings = payload.get("findings")
    if not isinstance(findings, list):
        return [], [{"reason": "findings_not_array", "finding": findings}]

    for finding in findings:
        if len(accepted) >= 12:
            rejected.append({"reason": "max_findings_exceeded", "finding": finding})
            continue
        if not isinstance(finding, dict):
            rejected.append({"reason": "finding_not_object", "finding": finding})
            continue

        handle = str(finding.get("creatorHandle") or "").lstrip("@").strip()
        if handle.lower() not in account_set:
            rejected.append({"reason": "creator_not_allowed", "finding": finding})
            continue

        url = str(finding.get("url") or "").strip()
        match = X_STATUS_RE.match(url)
        if not match:
            rejected.append({"reason": "invalid_status_url", "finding": finding})
            continue
        url_handle, status_id = match.group(1), match.group(2)
        if url_handle.lower() != handle.lower():
            rejected.append({"reason": "url_handle_mismatch", "finding": finding})
            continue

        source_text = str(finding.get("sourceText") or "").strip()
        if not source_text:
            rejected.append({"reason": "missing_source_text", "finding": finding})
            continue

        published_raw = finding.get("publishedAt")
        if not isinstance(published_raw, str) or not published_raw.strip():
            rejected.append({"reason": "missing_published_at", "finding": finding})
            continue
        try:
            published_at = datetime.fromisoformat(published_raw.replace("Z", "+00:00"))
        except ValueError:
            rejected.append({"reason": "missing_published_at", "finding": finding})
            continue
        if published_at < since or published_at > until:
            rejected.append({"reason": "published_at_outside_window", "finding": finding})
            continue

        if status_id in seen_ids:
            rejected.append({"reason": "duplicate_status_id", "finding": finding})
            continue

        key = handle.lower()
        if per_account.get(key, 0) >= 3:
            rejected.append({"reason": "max_findings_per_account_exceeded", "finding": finding})
            continue

        direction = finding.get("direction")
        if direction not in {"LONG", "SHORT", "WATCH", "NONE"}:
            direction = "NONE"
        strategy_match = finding.get("strategyMatch")
        if strategy_match not in {"MATCH", "CONFLICT", "UNKNOWN"}:
            strategy_match = "UNKNOWN"

        seen_ids.add(status_id)
        per_account[key] = per_account.get(key, 0) + 1
        accepted.append(
            {
                "creatorHandle": handle,
                "url": f"https://x.com/{url_handle}/status/{status_id}",
                "sourceText": source_text,
                "sourceTextKind": str(finding.get("sourceTextKind") or "verbatim_or_search_excerpt"),
                "publishedAt": published_raw,
                "language": str(finding.get("language") or "und"),
                "postType": str(finding.get("postType") or "original"),
                "summary": str(finding.get("summary") or "")[:200],
                "symbols": [str(item)[:20] for item in (finding.get("symbols") or [])[:5]],
                "direction": direction,
                "entryPrice": evidence_bound(
                    finding.get("entryPrice"), finding.get("entryPriceEvidence"), source_text
                ),
                "entryPriceEvidence": str(finding.get("entryPriceEvidence") or ""),
                "entryTiming": evidence_bound(
                    finding.get("entryTiming"), finding.get("entryTimingEvidence"), source_text
                ),
                "entryTimingEvidence": str(finding.get("entryTimingEvidence") or ""),
                "invalidation": evidence_bound(
                    finding.get("invalidation"), finding.get("invalidationEvidence"), source_text
                ),
                "invalidationEvidence": str(finding.get("invalidationEvidence") or ""),
                "strategyMatch": strategy_match,
                "strategyReason": str(finding.get("strategyReason") or "未明确"),
            }
        )

    return accepted, rejected


def sign_body(secret: str, timestamp: str, raw_body: str) -> str:
    digest = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}\n{raw_body}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"sha256={digest}"


def api_request(method: str, path: str, payload: dict[str, Any], signed: bool = False) -> dict[str, Any]:
    if not API_BASE or not INGEST_SECRET or len(INGEST_SECRET) < 32:
        raise RuntimeError("GROK_RADAR_API_URL / GROK_INGEST_SECRET not configured")

    raw_body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    timestamp = str(int(time.time()))
    headers = {
        "Authorization": f"Bearer {INGEST_SECRET}",
        "Content-Type": "application/json",
        "X-Grok-Timestamp": timestamp,
    }
    if signed:
        headers["X-Grok-Signature"] = sign_body(INGEST_SECRET, timestamp, raw_body)
        headers["Idempotency-Key"] = str(payload["run"]["id"])

    request = urllib.request.Request(
        f"{API_BASE}{path}",
        data=raw_body.encode("utf-8"),
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"api_{error.code}:{detail}") from error


def reserve_run(run_id: str) -> dict[str, Any]:
    return api_request("POST", "/grok-runs/reserve", {"runId": run_id}, signed=False)


def upload_ingest(payload: dict[str, Any]) -> dict[str, Any]:
    return api_request("POST", "/grok-ingest", payload, signed=True)


def build_prompt(config: dict[str, Any]) -> str:
    accounts = config["accounts"]
    keywords = config["keywords"]
    account_lines = "\n".join(f"- @{handle}" for handle in accounts)
    keyword_lines = "\n".join(f"- {keyword}" for keyword in keywords)
    template = PROMPT_TEMPLATE.read_text(encoding="utf-8")
    return (
        template.replace("{{SINCE}}", config["window"]["since"])
        .replace("{{UNTIL}}", config["window"]["until"])
        .replace("{{ACCOUNTS}}", account_lines)
        .replace("{{KEYWORDS}}", keyword_lines)
        .replace("{{STRATEGY}}", config["strategy"]["snapshot"] or "（暂无策略）")
        .replace("{{MAX_FINDINGS}}", str(config["limits"]["maxFindings"]))
        .replace(
            "{{MAX_FINDINGS_PER_ACCOUNT}}",
            str(config["limits"]["maxFindingsPerAccount"]),
        )
    )


def run_grok(run_id: str, prompt: str) -> dict[str, Any]:
    prompt_path = ROOT / "work" / f"{run_id}.prompt.txt"
    prompt_path.write_text(prompt, encoding="utf-8")
    prompt_path.chmod(0o600)
    command = [
        GROK_BIN,
        "--prompt-file",
        str(prompt_path),
        "--cwd",
        str(ROOT / "work"),
        "--sandbox",
        "strict",
        "--tools",
        "x_search",
        "--deny",
        "MCPTool",
        "--always-approve",
        "--model",
        MODEL,
        "--reasoning-effort",
        REASONING_EFFORT,
        "--output-format",
        "json",
        "--json-schema",
        json.dumps(RESULT_SCHEMA, separators=(",", ":")),
        "--no-memory",
        "--no-subagents",
        "--no-plan",
        "--max-turns",
        "8",
    ]

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
            check=False,
            env={**os.environ, "HOME": "/home/grok-runner"},
        )
        envelope = {
            "run_id": run_id,
            "exit_code": completed.returncode,
            "stdout": completed.stdout,
            "stderr": completed.stderr,
            "completed_at": iso(utc_now()),
        }
    except subprocess.TimeoutExpired as error:
        envelope = {
            "run_id": run_id,
            "exit_code": 124,
            "stdout": error.stdout or "",
            "stderr": error.stderr or "timeout",
            "completed_at": iso(utc_now()),
        }
    finally:
        prompt_path.unlink(missing_ok=True)

    return envelope


def flush_pending_uploads() -> None:
    pending_dir = ROOT / "pending-upload"
    if not pending_dir.exists():
        return
    for path in sorted(pending_dir.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        try:
            receipt = upload_ingest(payload)
            atomic_json(ROOT / "receipts" / path.name, receipt)
            path.unlink(missing_ok=True)
            print(json.dumps({"ok": True, "flushed": path.name, "receipt": receipt}, ensure_ascii=False))
        except Exception as error:  # noqa: BLE001 - keep queue for next timer
            print(json.dumps({"ok": False, "flush_error": str(error), "path": str(path)}), file=sys.stderr)


def preflight_grok() -> None:
    completed = subprocess.run(
        [GROK_BIN, "models"],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
        env={**os.environ, "HOME": "/home/grok-runner"},
    )
    if completed.returncode != 0:
        raise RuntimeError(f"grok_preflight_failed:{completed.stderr or completed.stdout}")


def main() -> int:
    for directory in (
        ROOT / "raw",
        ROOT / "normalized",
        ROOT / "rejected",
        ROOT / "pending-upload",
        ROOT / "receipts",
        ROOT / "state",
        ROOT / "work",
    ):
        directory.mkdir(parents=True, exist_ok=True)

    lock_path = ROOT / "state" / "collector.lock"
    with lock_path.open("w", encoding="utf-8") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({"ok": True, "skipped": "already_running"}))
            return 0

        flush_pending_uploads()

        replay_raw = os.environ.get("GROK_RADAR_REPLAY_RAW")
        if replay_raw:
            raw_path = Path(replay_raw).resolve()
            if raw_path.parent != (ROOT / "raw").resolve():
                raise ValueError("replay raw file must be inside the configured raw directory")
            envelope = json.loads(raw_path.read_text(encoding="utf-8"))
            run_id = str(envelope["run_id"])
            config = envelope["config"]
        else:
            preflight_grok()
            run_id = f"{utc_now().strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:10]}"
            try:
                config = reserve_run(run_id)
            except RuntimeError as error:
                message = str(error)
                if "429" in message and "weekly_run_limit_reached" in message:
                    print(json.dumps({"ok": True, "skipped": "weekly_run_limit_reached"}))
                    return 0
                print(json.dumps({"ok": False, "error": message}), file=sys.stderr)
                return 1

            prompt = build_prompt(config)
            envelope = run_grok(run_id, prompt)
            envelope["config"] = config
            envelope["window"] = config["window"]
            raw_path = ROOT / "raw" / f"{run_id}.json"
            atomic_json(raw_path, envelope)

        if envelope["exit_code"] != 0:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "run_id": run_id,
                        "exit_code": envelope["exit_code"],
                        "raw": str(raw_path),
                    }
                ),
                file=sys.stderr,
            )
            return 1

        try:
            cli_payload = json.loads(envelope["stdout"])
            model_payload = extract_model_payload(cli_payload["text"])
            accepted, rejected = validate_findings(
                model_payload,
                accounts=config["accounts"],
                window=config["window"],
            )
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            print(
                json.dumps(
                    {"ok": False, "run_id": run_id, "error": str(error), "raw": str(raw_path)}
                ),
                file=sys.stderr,
            )
            return 1

        normalized = {
            "run": {
                "id": run_id,
                "model": config["model"],
                "reasoningEffort": config["reasoningEffort"],
                "accounts": config["accounts"],
                "keywords": config["keywords"],
                "window": config["window"],
                "strategyVersion": config["strategy"]["version"],
            },
            "result": {
                "findings": accepted,
                "digestSummary": model_payload.get("digestSummary")
                if isinstance(model_payload.get("digestSummary"), list)
                else [],
            },
            "usage": cli_payload.get("usage"),
            "stderr": envelope.get("stderr"),
            "exitCode": envelope.get("exit_code"),
            "raw": {
                "stdout": envelope.get("stdout"),
                "cli": cli_payload,
            },
        }
        atomic_json(ROOT / "normalized" / f"{run_id}.json", normalized)
        if rejected:
            atomic_json(ROOT / "rejected" / f"{run_id}.json", {"run_id": run_id, "rejected": rejected})

        try:
            receipt = upload_ingest(normalized)
            atomic_json(ROOT / "receipts" / f"{run_id}.json", receipt)
            print(json.dumps({"ok": True, "run_id": run_id, "receipt": receipt}, ensure_ascii=False))
            return 0
        except Exception as error:  # noqa: BLE001
            pending_path = ROOT / "pending-upload" / f"{run_id}.json"
            atomic_json(pending_path, normalized)
            print(
                json.dumps(
                    {
                        "ok": False,
                        "run_id": run_id,
                        "error": str(error),
                        "pending_upload": str(pending_path),
                    }
                ),
                file=sys.stderr,
            )
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
