"""Capture feedback notes and promote them into TODO.md."""

from __future__ import annotations

import argparse
import json
import random
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

DEFAULT_QUEUE_PATH = Path("data/feedback_queue.json")
DEFAULT_TODO_PATH = Path("TODO.md")
DEFAULT_TODO_SECTION = "### Bugs / Polish"


def utc_now() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


def iso_utc(value: datetime | None = None) -> str:
    dt = value or utc_now()
    return dt.isoformat().replace("+00:00", "Z")


def generate_feedback_id(now: datetime | None = None) -> str:
    dt = now or utc_now()
    suffix = f"{random.randrange(16**4):04x}"
    return f"fb_{dt.strftime('%Y%m%d%H%M%S')}_{suffix}"


def parse_tags_csv(raw: str) -> list[str]:
    if not raw:
        return []
    return [token.strip().lower() for token in raw.split(",") if token.strip()]


def _ensure_queue_shape(queue: dict[str, Any]) -> dict[str, Any]:
    items = queue.get("items")
    if not isinstance(items, list):
        raise ValueError("feedback queue JSON must contain an 'items' list")
    return {"items": items}


def load_queue(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"items": []}
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid JSON in feedback queue: {path}") from exc
    if not isinstance(parsed, dict):
        raise ValueError("feedback queue JSON must be an object")
    return _ensure_queue_shape(parsed)


def save_queue(path: Path, queue: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    normalized = _ensure_queue_shape(queue)
    path.write_text(json.dumps(normalized, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def compact_text(value: str, max_len: int) -> str:
    normalized = re.sub(r"\s+", " ", value.strip())
    if len(normalized) <= max_len:
        return normalized
    return normalized[: max_len - 3].rstrip() + "..."


def infer_todo_title(feedback_text: str) -> str:
    normalized = compact_text(feedback_text, 180)
    if not normalized:
        return "Feedback follow-up"
    first_sentence = re.split(r"[.!?]", normalized, maxsplit=1)[0].strip()
    candidate = first_sentence or normalized
    return compact_text(candidate, 56)


def add_feedback_item(
    queue: dict[str, Any],
    *,
    text: str,
    source: str,
    tags: list[str] | None = None,
    now: datetime | None = None,
    item_id: str | None = None,
) -> dict[str, Any]:
    if not text or not text.strip():
        raise ValueError("feedback text cannot be empty")
    created = now or utc_now()
    item = {
        "id": item_id or generate_feedback_id(created),
        "created_at": iso_utc(created),
        "source": (source or "user").strip() or "user",
        "tags": tags or [],
        "text": compact_text(text, 500),
        "status": "new",
    }
    queue.setdefault("items", []).append(item)
    return item


def _find_item(queue: dict[str, Any], item_id: str) -> dict[str, Any]:
    for item in queue.get("items", []):
        if item.get("id") == item_id:
            return item
    raise ValueError(f"feedback id not found: {item_id}")


def insert_todo_line(todo_path: Path, section_heading: str, todo_line: str) -> bool:
    if not todo_path.exists():
        raise ValueError(f"TODO file does not exist: {todo_path}")
    original_text = todo_path.read_text(encoding="utf-8")
    lines = original_text.splitlines()
    if todo_line in lines:
        return False

    section_idx = None
    for idx, line in enumerate(lines):
        if line.strip() == section_heading.strip():
            section_idx = idx
            break
    if section_idx is None:
        raise ValueError(f"section heading not found in {todo_path}: {section_heading}")

    next_heading_idx = len(lines)
    for idx in range(section_idx + 1, len(lines)):
        if lines[idx].startswith("### "):
            next_heading_idx = idx
            break

    insert_idx = next_heading_idx
    while insert_idx > section_idx + 1 and lines[insert_idx - 1].strip() == "":
        insert_idx -= 1

    lines.insert(insert_idx, todo_line)
    todo_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return True


def promote_feedback_item(
    queue: dict[str, Any],
    *,
    item_id: str,
    todo_path: Path,
    section_heading: str,
    title: str | None = None,
    note: str | None = None,
    now: datetime | None = None,
) -> tuple[dict[str, Any], bool]:
    item = _find_item(queue, item_id)
    if item.get("status") == "promoted":
        return item, False

    item_text = str(item.get("text", "")).strip()
    todo_title = compact_text((title or infer_todo_title(item_text)).strip() or "Feedback follow-up", 80)
    todo_note = compact_text((note or item_text).strip(), 240)
    todo_line = f"- [ ] **{todo_title}** -- {todo_note} (feedback {item_id})"
    inserted = insert_todo_line(todo_path, section_heading, todo_line)

    item["status"] = "promoted"
    item["todo_line"] = todo_line
    item["todo_section"] = section_heading
    item["todo_added_at"] = iso_utc(now or utc_now())
    return item, inserted


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Capture feedback and promote to TODO.md")
    parser.add_argument("--queue", default=str(DEFAULT_QUEUE_PATH), help="Path to feedback queue JSON")

    sub = parser.add_subparsers(dest="command", required=True)

    add = sub.add_parser("add", help="Add a feedback item")
    add.add_argument("--text", required=True, help="Feedback text")
    add.add_argument("--source", default="user", help="Feedback source label")
    add.add_argument("--tags", default="", help="Comma-separated tags")
    add.add_argument("--promote", action="store_true", help="Immediately add this feedback to TODO.md")
    add.add_argument("--todo-file", default=str(DEFAULT_TODO_PATH), help="Path to TODO markdown file")
    add.add_argument("--section", default=DEFAULT_TODO_SECTION, help="Section heading in TODO.md")
    add.add_argument("--title", default=None, help="Override TODO item title")
    add.add_argument("--note", default=None, help="Override TODO item note/body")

    list_cmd = sub.add_parser("list", help="List feedback items")
    list_cmd.add_argument(
        "--status",
        default="open",
        choices=["open", "promoted", "all"],
        help="Filter queue by status",
    )
    list_cmd.add_argument("--limit", type=int, default=30, help="Max number of rows")

    promote = sub.add_parser("promote", help="Promote an existing feedback item to TODO.md")
    promote.add_argument("--id", required=True, help="Feedback id to promote")
    promote.add_argument("--todo-file", default=str(DEFAULT_TODO_PATH), help="Path to TODO markdown file")
    promote.add_argument("--section", default=DEFAULT_TODO_SECTION, help="Section heading in TODO.md")
    promote.add_argument("--title", default=None, help="Override TODO item title")
    promote.add_argument("--note", default=None, help="Override TODO item note/body")

    return parser


def _status_matches(item: dict[str, Any], status: str) -> bool:
    if status == "all":
        return True
    if status == "open":
        return item.get("status") != "promoted"
    return item.get("status") == "promoted"


def cmd_add(args: argparse.Namespace) -> int:
    queue_path = Path(args.queue)
    todo_path = Path(args.todo_file)
    queue = load_queue(queue_path)
    item = add_feedback_item(
        queue,
        text=args.text,
        source=args.source,
        tags=parse_tags_csv(args.tags),
    )
    promoted = False
    if args.promote:
        _, promoted = promote_feedback_item(
            queue,
            item_id=item["id"],
            todo_path=todo_path,
            section_heading=args.section,
            title=args.title,
            note=args.note,
        )
    save_queue(queue_path, queue)
    print(f"captured feedback {item['id']}")
    if args.promote:
        print("promoted to TODO.md" if promoted else "already present in TODO.md")
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    queue = load_queue(Path(args.queue))
    filtered = [item for item in queue.get("items", []) if _status_matches(item, args.status)]
    filtered.sort(key=lambda item: str(item.get("created_at", "")), reverse=True)
    for item in filtered[: args.limit]:
        feedback_id = item.get("id", "?")
        status = item.get("status", "new")
        created = item.get("created_at", "")
        source = item.get("source", "")
        text = compact_text(str(item.get("text", "")), 120)
        print(f"{feedback_id} [{status}] {created} {source} :: {text}")
    print(f"{len(filtered)} item(s) matched")
    return 0


def cmd_promote(args: argparse.Namespace) -> int:
    queue_path = Path(args.queue)
    queue = load_queue(queue_path)
    item, inserted = promote_feedback_item(
        queue,
        item_id=args.id,
        todo_path=Path(args.todo_file),
        section_heading=args.section,
        title=args.title,
        note=args.note,
    )
    save_queue(queue_path, queue)
    print(f"promoted feedback {item['id']}")
    if not inserted:
        print("TODO item already present; queue status updated")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "add":
        return cmd_add(args)
    if args.command == "list":
        return cmd_list(args)
    if args.command == "promote":
        return cmd_promote(args)
    parser.error(f"unsupported command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

