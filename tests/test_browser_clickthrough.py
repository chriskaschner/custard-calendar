"""Headless browser smoke test for docs navigation."""

from __future__ import annotations

import os
import socket
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_BROWSER_TESTS") == "1",
    reason="SKIP_BROWSER_TESTS=1 — no Chrome in this environment",
)

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKER_DIR = REPO_ROOT / "worker"
PLAYWRIGHT_CONFIG = WORKER_DIR / "playwright.config.mjs"


def _find_browser_binary() -> str:
    candidates = [
        os.environ.get("CHROME_BIN"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    raise AssertionError(
        "No Chrome/Chromium browser binary found. "
        "Set CHROME_BIN to a local Chrome/Chromium executable path."
    )


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def test_docs_browser_smoke_suite():
    """Run browser smoke tests (nav + Radar Phase 2 interactions)."""

    playwright_bin = WORKER_DIR / "node_modules" / ".bin" / "playwright"
    if not playwright_bin.exists():
        playwright_bin = WORKER_DIR / "node_modules" / ".bin" / "playwright.cmd"
    assert playwright_bin.exists(), (
        "Missing Playwright binary at worker/node_modules/.bin/playwright. "
        "Run: cd worker && npm install"
    )
    assert PLAYWRIGHT_CONFIG.exists(), f"Missing Playwright config: {PLAYWRIGHT_CONFIG}"

    env = os.environ.copy()
    env["CHROME_BIN"] = _find_browser_binary()
    env["PLAYWRIGHT_DOCS_PORT"] = str(_find_free_port())

    result = subprocess.run(
        [
            str(playwright_bin),
            "test",
            "--config",
            str(PLAYWRIGHT_CONFIG),
            "--workers",
            "1",
        ],
        cwd=WORKER_DIR,
        env=env,
        capture_output=True,
        text=True,
        # This runs the entire Playwright suite (150+ specs), not a handful of
        # smoke tests, and it grew past the old 180s cap some time ago -- the
        # assert below was reporting a timeout, not a browser failure. Measured
        # at ~7 min on an M-series laptop; 20 min leaves room for CI being
        # slower without hiding a genuine hang.
        timeout=1200,
    )

    assert result.returncode == 0, (
        "Browser click-through failed.\n"
        f"STDOUT:\n{result.stdout}\n"
        f"STDERR:\n{result.stderr}"
    )
