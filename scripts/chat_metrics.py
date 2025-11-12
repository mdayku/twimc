#!/usr/bin/env python3
"""
chat_metrics.py — quantify how much of a conversation was spent on debugging/log-reading vs new feature development.
- Works on JSON or CSV chat exports containing at least: timestamp, role, content. (Both user + assistant preferred.)
- No external deps. Token counts are estimated as ceil(num_chars / 4).

USAGE
-----
python chat_metrics.py --chat path/to/chat.json --out out_dir
# Optional: CSV input, custom time cap, keyword overrides:
python chat_metrics.py --chat path/to/chat.csv --format csv --cap-mins 20 --out out_dir

INPUT FORMATS
-------------
JSON: Either of the following shapes are supported:
  {"messages":[{"timestamp":"2025-11-10T16:23:00Z","role":"user","content":"..."} ...]}
  [{"timestamp":"2025-11-10 16:23:00","role":"assistant","content":"..."} ...]

CSV: Columns (lower/upper OK): timestamp, role, content

OUTPUTS
-------
- out_dir/summary.json : overall metrics
- out_dir/by_turn.csv  : per-turn classification with time & token estimates
- Prints a human-friendly summary to stdout

CATEGORIES
----------
We classify each "turn group" (user message + following assistant reply, if present) into one of:
- DEBUG_LOG     (debugging/logs/errors/build failures/tracebacks/etc.)
- FEATURE_DEV   (building features, writing code, scaffolding new components/APIs)
- TEST_DOCS_CI  (tests, docs, CI, migrations, schema work; not counted toward FEATURE_DEV)
- OTHER         (planning, Q&A, brainstorming, misc.)

Time accounting:
- The duration for a user turn is time until the next user message (capped via --cap-mins; default 20).
- If there's no next user message, we cap at --cap-mins.
- Tokens are estimated for both user + assistant contents in that turn group (if present).

Adjust keyword lists at the bottom if needed, or pass --keyword-dump to print them.
"""

import json, csv, os, math, argparse, re
from datetime import datetime, timedelta
from typing import List, Dict, Any

DT_FORMATS = [
    "%Y-%m-%dT%H:%M:%S.%fZ",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%m/%d/%Y %H:%M",
    "%m/%d/%y %H:%M",
]

def parse_dt(s: str) -> datetime:
    s = s.strip()
    for fmt in DT_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            continue
    # try ISO loose
    try:
        return datetime.fromisoformat(s.replace("Z",""))
    except Exception:
        pass
    raise ValueError(f"Unrecognized timestamp format: {s}")

def read_chat(path: str, fmt: str) -> List[Dict[str, Any]]:
    if fmt == "auto":
        if path.lower().endswith(".json"):
            fmt = "json"
        elif path.lower().endswith(".csv"):
            fmt = "csv"
        else:
            fmt = "json"
    msgs: List[Dict[str, Any]] = []
    if fmt == "json":
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and "messages" in data:
            items = data["messages"]
        elif isinstance(data, list):
            items = data
        else:
            raise ValueError("JSON shape not recognized. Expect list or {'messages':[...]}")
        for m in items:
            ts = m.get("timestamp") or m.get("time") or m.get("created_at") or m.get("date")
            role = (m.get("role") or "").lower()
            content = m.get("content") or m.get("text") or ""
            if not ts or not role:
                # skip malformed
                continue
            try:
                dt = parse_dt(ts)
            except Exception:
                continue
            msgs.append({"timestamp": dt, "role": role, "content": str(content)})
    elif fmt == "csv":
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ts = (row.get("timestamp") or row.get("time") or row.get("created_at") or row.get("date") or "").strip()
                role = (row.get("role") or "").strip().lower()
                content = (row.get("content") or row.get("text") or "").strip()
                if not ts or not role:
                    continue
                try:
                    dt = parse_dt(ts)
                except Exception:
                    continue
                msgs.append({"timestamp": dt, "role": role, "content": content})
    else:
        raise ValueError("fmt must be json or csv")
    msgs.sort(key=lambda m: m["timestamp"])
    return msgs

# --- Classification -----------------------------------------------------------

DEBUG_PATTERNS = [
    r"\b(error|exception|traceback|stack\s*trace|crash|panic|bug|fix|regression)\b",
    r"\b(failed|failing|doesn'?t work|broken|hangs|timeout|segfault)\b",
    r"\b(404|401|500|403|502|503)\b",
    r"\b(null reference|undefined|TypeError|NameError|KeyError|IndexError|ReferenceError)\b",
    r"\b(log|stderr|stdout|console\.log|print\(.*\)|logger)\b",
    r"\b(build failed|compile error|lint error|tsc error|pytest failed|unit test failed)\b",
    r"\b(deploy fail|rollback|hotfix|incident)\b",
]

FEATURE_PATTERNS = [
    r"\b(implement|add|create|build|ship|scaffold|wire|integrate|hook up)\b",
    r"\b(feature|endpoint|api|component|screen|ui|route|schema|migration|model)\b",
    r"\b(refactor|optimi[sz]e|rewrite)\b",
]

TEST_DOCS_CI_PATTERNS = [
    r"\b(test|unit test|e2e|integration test|playwright|pytest|jest)\b",
    r"\b(doc[s]?|readme|changelog|prd|adr|spec)\b",
    r"\b(ci|pipeline|lint|typecheck|tsc|ruff|black|pre-commit|github actions|prisma migrate|alembic)\b",
]

def any_match(text: str, patterns: List[str]) -> bool:
    for p in patterns:
        if re.search(p, text, flags=re.I):
            return True
    return False

def classify_turn(user_text: str, assistant_text: str) -> str:
    blob = f"{user_text}\n{assistant_text}".lower()

    # Explicit MODE tags dominate classification
    if re.search(r'\bMODE:\s*TEST\b', blob, flags=re.I): return "TEST_DOCS_CI"
    if re.search(r'\bMODE:\s*DOCS\b', blob, flags=re.I): return "TEST_DOCS_CI"
    if re.search(r'\bMODE:\s*ASK\b', blob, flags=re.I): return "OTHER"
    if re.search(r'\bMODE:\s*PLAN\b', blob, flags=re.I): return "OTHER"
    if re.search(r'\bMODE:\s*BUILD\b', blob, flags=re.I): return "FEATURE_DEV"

    if any_match(blob, DEBUG_PATTERNS):
        return "DEBUG_LOG"
    if any_match(blob, TEST_DOCS_CI_PATTERNS):
        # classify tests/docs/ci separate from pure feature dev
        return "TEST_DOCS_CI"
    if any_match(blob, FEATURE_PATTERNS):
        return "FEATURE_DEV"
    return "OTHER"

def token_estimate(text: str) -> int:
    # crude: 1 token ~ 4 chars
    return math.ceil(len(text) / 4) if text else 0

def group_turns(msgs: List[Dict[str, Any]], cap_minutes: int = 20) -> List[Dict[str, Any]]:
    """Group as (user message, following assistant reply if present), compute duration until next user message."""
    turns = []
    user_indices = [i for i,m in enumerate(msgs) if m["role"]=="user"]
    for idx, ui in enumerate(user_indices):
        u = msgs[ui]
        # next user time (for duration cap)
        if idx+1 < len(user_indices):
            next_u = msgs[user_indices[idx+1]]["timestamp"]
        else:
            # If no next user, set far future; we'll cap later
            next_u = u["timestamp"] + timedelta(minutes=cap_minutes+5)
        # find the first assistant after this user (optional)
        ai = None
        for j in range(ui+1, len(msgs)):
            if msgs[j]["role"] == "assistant":
                ai = msgs[j]
                break
            if msgs[j]["role"] == "user":
                break
        # duration = min(next_user - this_user, cap)
        dur = min(next_u - u["timestamp"], timedelta(minutes=cap_minutes))
        a_text = ai["content"] if ai else ""
        category = classify_turn(u["content"], a_text)
        tokens = token_estimate(u["content"]) + token_estimate(a_text)
        turns.append({
            "user_time": u["timestamp"].isoformat(sep=" "),
            "duration_minutes": round(dur.total_seconds()/60, 2),
            "category": category,
            "user_chars": len(u["content"]),
            "assistant_chars": len(a_text),
            "tokens_est": tokens,
            "user_excerpt": (u["content"][:140] + ("…" if len(u["content"])>140 else "")),
        })
    return turns

def summarize(turns: List[Dict[str, Any]]) -> Dict[str, Any]:
    totals = {"DEBUG_LOG": {"mins":0.0,"tokens":0}, "FEATURE_DEV":{"mins":0.0,"tokens":0},
              "TEST_DOCS_CI":{"mins":0.0,"tokens":0}, "OTHER":{"mins":0.0,"tokens":0}}
    for t in turns:
        c = t["category"]
        totals[c]["mins"] += t["duration_minutes"]
        totals[c]["tokens"] += t["tokens_est"]
    grand_mins = sum(v["mins"] for v in totals.values())
    grand_tokens = sum(v["tokens"] for v in totals.values())
    share = {
        k: {
            "mins": round(v["mins"],2),
            "mins_share": round((v["mins"]/grand_mins*100) if grand_mins else 0, 1),
            "tokens": v["tokens"],
            "tokens_share": round((v["tokens"]/grand_tokens*100) if grand_tokens else 0, 1)
        }
        for k,v in totals.items()
    }
    return {
        "totals": share,
        "grand": {"mins": round(grand_mins,2), "tokens": grand_tokens},
        "notes": "Time per turn capped; tokens are character-based estimates (chars/4)."
    }

def save_csv(turns: List[Dict[str, Any]], path: str):
    import csv
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(turns[0].keys()) if turns else [])
        w.writeheader()
        for t in turns:
            w.writerow(t)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chat", required=True, help="Path to JSON or CSV export")
    ap.add_argument("--format", choices=["auto","json","csv"], default="auto")
    ap.add_argument("--cap-mins", type=int, default=20, help="Cap minutes credited to a single turn (default 20)")
    ap.add_argument("--out", required=True, help="Output directory")
    ap.add_argument("--keyword-dump", action="store_true", help="Print keyword patterns and exit")
    args = ap.parse_args()

    if args.keyword_dump:
        print("DEBUG_PATTERNS:", DEBUG_PATTERNS)
        print("FEATURE_PATTERNS:", FEATURE_PATTERNS)
        print("TEST_DOCS_CI_PATTERNS:", TEST_DOCS_CI_PATTERNS)
        return

    msgs = read_chat(args.chat, args.format)
    if not msgs:
        raise SystemExit("No messages parsed. Check --format and input structure.")
    turns = group_turns(msgs, cap_minutes=args.cap_mins)
    summary = summarize(turns)

    os.makedirs(args.out, exist_ok=True)
    byturn_path = os.path.join(args.out, "by_turn.csv")
    save_csv(turns, byturn_path)

    with open(os.path.join(args.out, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    # Console report
    print("\n=== Chat Metrics Summary ===")
    print(f"Total credited minutes: {summary['grand']['mins']} (cap {args.cap_mins}m/turn)")
    print(f"Total estimated tokens: {summary['grand']['tokens']} (~chars/4)")
    for k in ["FEATURE_DEV","DEBUG_LOG","TEST_DOCS_CI","OTHER"]:
        v = summary["totals"][k]
        print(f"{k:13s}  mins={v['mins']:>7}  ({v['mins_share']:>5}%)   tokens={v['tokens']:>8}  ({v['tokens_share']:>5}%)")
    print(f"\nPer-turn details -> {byturn_path}")
    print("Notes: Token est. is crude; for exact numbers, join with provider usage logs by timestamp.")
    print("      Tune patterns inside script or pass --keyword-dump to review.")
    return

# Keyword patterns (tweak here)
DEBUG_PATTERNS = [
    r"\b(error|exception|traceback|stack\s*trace|crash|panic|bug|fix|regression)\b",
    r"\b(failed|failing|doesn'?t work|broken|hangs|timeout|segfault)\b",
    r"\b(404|401|500|403|502|503)\b",
    r"\b(null reference|undefined|TypeError|NameError|KeyError|IndexError|ReferenceError)\b",
    r"\b(log|stderr|stdout|console\.log|print\(.*\)|logger)\b",
    r"\b(build failed|compile error|lint error|tsc error|pytest failed|unit test failed)\b",
    r"\b(deploy fail|rollback|hotfix|incident)\b",
]

FEATURE_PATTERNS = [
    r"\b(implement|add|create|build|ship|scaffold|wire|integrate|hook up)\b",
    r"\b(feature|endpoint|api|component|screen|ui|route|schema|migration|model)\b",
    r"\b(refactor|optimi[sz]e|rewrite)\b",
]

TEST_DOCS_CI_PATTERNS = [
    r"\b(test|unit test|e2e|integration test|playwright|pytest|jest)\b",
    r"\b(doc[s]?|readme|changelog|prd|adr|spec)\b",
    r"\b(ci|pipeline|lint|typecheck|tsc|ruff|black|pre-commit|github actions|prisma migrate|alembic)\b",
]

if __name__ == "__main__":
    main()