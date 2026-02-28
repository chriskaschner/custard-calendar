#!/usr/bin/env python3
"""Fail CI when security status docs drift out of sync."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TODO_PATH = ROOT / "TODO.md"
SECURITY_PATH = ROOT / "SECURITY_AND_OBSERVABILITY.md"

EXPECTED_IDS = [f"M{i}" for i in range(1, 7)] + [f"L{i}" for i in range(1, 7)] + [f"X{i}" for i in range(1, 4)]
ALLOWED_STATUS = {"Open", "Partial", "Resolved", "Accepted"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def normalize_status(raw: str) -> str | None:
    text = raw.strip().lower()
    if "partially resolved" in text or text == "partial":
        return "Partial"
    if "resolved" in text:
        return "Resolved"
    if "accepted" in text:
        return "Accepted"
    if "open" in text:
        return "Open"
    return None


def parse_todo_ledger(path: Path) -> tuple[dict[str, dict[str, str]], list[str]]:
    errors: list[str] = []
    lines = path.read_text().splitlines()

    start_idx = None
    for idx, line in enumerate(lines):
        if line.strip() == "## Security/Observability Status Ledger":
            start_idx = idx
            break
    if start_idx is None:
        return {}, [f"{path.name}: missing '## Security/Observability Status Ledger' section"]

    rows: dict[str, dict[str, str]] = {}
    for line in lines[start_idx + 1 :]:
        if line.startswith("## "):
            break
        if not line.strip().startswith("|"):
            continue
        parts = [p.strip() for p in line.strip().split("|")]
        # split("|") on a table line gives: "", col1, col2, ..., ""
        if len(parts) < 8:
            continue
        cols = parts[1:-1]
        if not cols or cols[0] in {"ID", "---"}:
            continue
        if len(cols) < 6:
            continue
        row_id = cols[0]
        rows[row_id] = {
            "status": cols[1],
            "owner_files": cols[2],
            "tests": cols[3],
            "last_verified": cols[4],
            "commit": cols[5],
        }

    if not rows:
        errors.append(f"{path.name}: security ledger table rows not found")
    return rows, errors


def parse_security_status(path: Path) -> tuple[dict[str, str], list[str]]:
    errors: list[str] = []
    lines = path.read_text().splitlines()
    statuses: dict[str, str] = {}

    heading_re = re.compile(r"^### .+ — ((?:M|L|X)\d):")
    status_re = re.compile(r"^\*\*Status:\*\*\s*(.+)$")

    for idx, line in enumerate(lines):
        heading = heading_re.match(line.strip())
        if not heading:
            continue
        finding_id = heading.group(1)
        status_value = None
        for probe in lines[idx + 1 :]:
            if probe.startswith("### "):
                break
            match = status_re.match(probe.strip())
            if match:
                status_value = normalize_status(match.group(1))
                break
        if status_value is None:
            errors.append(f"{path.name}: missing/unknown status for {finding_id}")
            continue
        statuses[finding_id] = status_value

    return statuses, errors


def validate() -> list[str]:
    errors: list[str] = []

    ledger, ledger_errors = parse_todo_ledger(TODO_PATH)
    security_status, security_errors = parse_security_status(SECURITY_PATH)
    errors.extend(ledger_errors)
    errors.extend(security_errors)

    expected_set = set(EXPECTED_IDS)
    ledger_ids = set(ledger.keys())
    security_ids = set(security_status.keys())

    missing_ledger = sorted(expected_set - ledger_ids)
    extra_ledger = sorted(ledger_ids - expected_set)
    if missing_ledger:
        errors.append(f"TODO.md ledger missing IDs: {', '.join(missing_ledger)}")
    if extra_ledger:
        errors.append(f"TODO.md ledger has unexpected IDs: {', '.join(extra_ledger)}")

    missing_security = sorted(expected_set - security_ids)
    if missing_security:
        errors.append(f"SECURITY_AND_OBSERVABILITY.md missing finding IDs: {', '.join(missing_security)}")

    for finding_id in EXPECTED_IDS:
        row = ledger.get(finding_id)
        if not row:
            continue

        status = normalize_status(row["status"])
        if status not in ALLOWED_STATUS:
            errors.append(f"TODO.md invalid status for {finding_id}: {row['status']!r}")
        if not row["owner_files"] or row["owner_files"] == "-":
            errors.append(f"TODO.md missing owner file(s) for {finding_id}")
        if not row["tests"] or row["tests"] == "-":
            errors.append(f"TODO.md missing verification test(s) for {finding_id}")
        if not DATE_RE.match(row["last_verified"]):
            errors.append(f"TODO.md invalid last-verified date for {finding_id}: {row['last_verified']!r}")
        if not row["commit"] or row["commit"] == "-":
            errors.append(f"TODO.md missing reference commit for {finding_id}")

        doc_status = security_status.get(finding_id)
        if status and doc_status and status != doc_status:
            errors.append(
                f"Status mismatch for {finding_id}: TODO.md={status}, SECURITY_AND_OBSERVABILITY.md={doc_status}"
            )

    return errors


def main() -> int:
    errors = validate()
    if errors:
        print("Security status doc check failed:")
        for item in errors:
            print(f"- {item}")
        return 1
    print("Security status docs are in sync.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
