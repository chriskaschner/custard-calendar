"""Tests for scripts/feedback_queue.py."""

from __future__ import annotations

import sys
from datetime import UTC, datetime
from pathlib import Path

# Ensure project root is on sys.path
_project_root = str(Path(__file__).resolve().parents[2])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.feedback_queue import (  # noqa: E402
    add_feedback_item,
    insert_todo_line,
    parse_tags_csv,
    promote_feedback_item,
)


def test_parse_tags_csv_normalizes_tokens():
    assert parse_tags_csv("Map, UX , radar ,,") == ["map", "ux", "radar"]


def test_insert_todo_line_inserts_in_section(tmp_path):
    todo = tmp_path / "TODO.md"
    todo.write_text(
        "# TODO\n\n"
        "## Active\n\n"
        "### Product Features\n"
        "- [ ] Existing feature\n\n"
        "### Bugs / Polish\n"
        "- [ ] Existing polish item\n\n"
        "### Docs\n"
        "(none)\n",
        encoding="utf-8",
    )

    inserted = insert_todo_line(
        todo,
        "### Bugs / Polish",
        "- [ ] **New Feedback Item** -- polish details",
    )
    assert inserted is True

    content = todo.read_text(encoding="utf-8")
    assert "- [ ] **New Feedback Item** -- polish details" in content
    assert content.index("### Bugs / Polish") < content.index("**New Feedback Item**")
    assert content.index("**New Feedback Item**") < content.index("### Docs")


def test_promote_feedback_item_updates_queue_and_todo(tmp_path):
    queue = {
        "items": [
            {
                "id": "fb_test_001",
                "created_at": "2026-02-23T15:00:00Z",
                "source": "user",
                "tags": ["map"],
                "text": "Need more dynamic weather-style map overlays with cluster-like groupings.",
                "status": "new",
            }
        ]
    }
    todo = tmp_path / "TODO.md"
    todo.write_text(
        "# TODO\n\n"
        "## Active\n\n"
        "### Product Features\n"
        "- [x] Existing\n\n",
        encoding="utf-8",
    )

    item, inserted = promote_feedback_item(
        queue,
        item_id="fb_test_001",
        todo_path=todo,
        section_heading="### Product Features",
        title="Dynamic clustered map overlays",
        note="Add weather-style clustering visuals to map/fronts views.",
        now=datetime(2026, 2, 23, 15, 10, tzinfo=UTC),
    )

    assert inserted is True
    assert item["status"] == "promoted"
    assert item["todo_section"] == "### Product Features"
    assert "Dynamic clustered map overlays" in item["todo_line"]
    assert "feedback fb_test_001" in item["todo_line"]
    assert item["todo_added_at"] == "2026-02-23T15:10:00Z"

    content = todo.read_text(encoding="utf-8")
    assert "Dynamic clustered map overlays" in content
    assert "feedback fb_test_001" in content


def test_add_feedback_item_sets_defaults():
    queue = {"items": []}
    item = add_feedback_item(
        queue,
        text="Capture this note",
        source="manual",
        tags=["todo"],
        now=datetime(2026, 2, 23, 15, 20, tzinfo=UTC),
        item_id="fb_fixed",
    )
    assert item["id"] == "fb_fixed"
    assert item["source"] == "manual"
    assert item["status"] == "new"
    assert item["created_at"] == "2026-02-23T15:20:00Z"
    assert queue["items"][0]["id"] == "fb_fixed"

