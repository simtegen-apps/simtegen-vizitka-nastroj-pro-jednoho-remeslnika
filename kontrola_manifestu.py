"""CI gate: the code must not contradict data-manifest.json.

Version 1 is a deliberately crude, deterministic heuristic: it greps the
deployed files for patterns that would mean network calls or browser storage
the manifest does not declare. It cannot prove compliance -- it exists so the
manifest cannot drift from reality *silently*, which is the failure mode that
turns a policy document into an aggravating circumstance. The legal template
itself is written and frozen by a human lawyer, never generated.

Stdlib only, so the CI step needs nothing but python3.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# The messages carry Czech diacritics; a Windows console defaulting to a
# legacy codepage must not turn a failed check into a UnicodeEncodeError.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

WEB = Path("web")
MANIFEST = Path("data-manifest.json")

# Patterns that mean an outbound request from the page (loading a foreign
# resource or calling out). Plain links (<a href="http...">) are fine -- the
# user clicks them; resources load without asking.
NETWORK_PATTERNS = (
    "fetch(",
    "XMLHttpRequest",
    "sendBeacon",
    "new WebSocket",
    '<script src="http',
    "<script src='http",
    'href="http',  # only checked inside <link ...> lines, see below
    "@import url(http",
    '<img src="http',
    "<img src='http",
)

STORAGE_PATTERNS = (
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "document.cookie",
)


def main() -> int:
    if not MANIFEST.exists():
        print("CHYBA: chybí data-manifest.json.")
        return 1
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    violations: list[str] = []

    for path in sorted(WEB.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in (
            ".html", ".htm", ".js", ".css", ".mjs",
        ):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        lines = text.splitlines()

        if manifest.get("externi_pozadavky") == "zadne":
            for number, line in enumerate(lines, 1):
                for pattern in NETWORK_PATTERNS:
                    if pattern == 'href="http':
                        # An external stylesheet is a request; a plain link is not.
                        if "<link" in line and pattern in line:
                            violations.append(f"{path}:{number}: externí <link> ({line.strip()[:80]})")
                        continue
                    if pattern in line:
                        violations.append(f"{path}:{number}: {pattern} ({line.strip()[:80]})")

        if not manifest.get("uloziste_v_prohlizeci"):
            for number, line in enumerate(lines, 1):
                for pattern in STORAGE_PATTERNS:
                    if pattern in line:
                        violations.append(f"{path}:{number}: {pattern} ({line.strip()[:80]})")

    if violations:
        print("Kód se rozešel s data-manifest.json:")
        for violation in violations:
            print(" -", violation)
        print("Buď to z kódu odstraň, nebo to deklaruj v manifestu (a v zásadách).")
        return 1
    print("Manifest souhlasí s kódem.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
