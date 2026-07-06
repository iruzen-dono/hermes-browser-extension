"""In-memory browser context cache for the Hermes Browser companion plugin.

Stores the latest Browser Context Protocol payload received from the
Hermes Browser Extension, along with a bounded event log for diagnostics.
The store is deliberately process-local — it does not persist across
Hermes restarts.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from time import time
from typing import Any

from .protocol import BrowserContextEnvelope

# Regex to match the browser context block embedded in extension prompts.
_CONTEXT_BLOCK_RE = re.compile(
    r"UNTRUSTED_BROWSER_CONTEXT_START\s*\n"
    r"(?P<body>.*?)"
    r"\nUNTRUSTED_BROWSER_CONTEXT_END",
    re.DOTALL,
)

# Parse key-value lines inside the context block.
_KV_RE = re.compile(r"^(?P<key>[A-Za-z /]+?):\s*(?P<value>.+)$", re.MULTILINE)


def parse_context_block(text: str) -> dict[str, Any] | None:
    """Extract browser context fields from an extension prompt block.

    Returns a dict with keys like *active_tab_title*, *active_tab_url*,
    *context_scope*, *page_text*, etc., or ``None`` if no block is found.
    """
    match = _CONTEXT_BLOCK_RE.search(text)
    if not match:
        return None

    body = match.group("body")
    result: dict[str, Any] = {
        "raw": body[:2000],  # Keep a short excerpt for verification
        "activeTab": {},
    }

    # Parse header key-value pairs until we hit a blank then a section header.
    lines = body.split("\n")
    header_done = False
    sections: dict[str, list[str]] = {}
    current_section = "_header"

    for line in lines:
        stripped = line.strip()
        if not header_done:
            if not stripped:
                header_done = True
                continue
            kv = _KV_RE.match(line)
            if kv:
                key = kv.group("key").strip().lower().replace(" ", "_")
                value = kv.group("value").strip()
                if key.startswith("active_tab_"):
                    sub_key = key.replace("active_tab_", "")
                    result["activeTab"][sub_key] = value
                elif key == "context_scope":
                    result["contextScope"] = value
                elif key == "open_tabs":
                    result["tabsSummary"] = value
                else:
                    result[key] = value
        else:
            if stripped and not stripped.startswith("-") and stripped.endswith(":"):
                current_section = stripped[:-1].lower().replace(" ", "_")
                sections.setdefault(current_section, [])
            elif stripped:
                sections.setdefault(current_section, []).append(stripped)

    # Store captured sections
    result["pageTextAvailable"] = bool(sections.get("page_text", []))
    result["selectedTextAvailable"] = bool(sections.get("selected_text", []))
    result["youtubeTranscript"] = bool(sections.get("youtube_transcript", []))

    # Determine scope
    scope_raw = result.get("contextScope", "")
    result["contextScope"] = scope_raw if scope_raw else "follow-active-tab"

    return result


@dataclass
class BrowserContextStore:
    """Process-local, in-memory browser context cache.

    The store is populated automatically by the ``pre_llm_call`` hook when
    it detects an ``UNTRUSTED_BROWSER_CONTEXT_START`` block in a user
    message, or explicitly via :meth:`update_from_tool`.
    """

    envelope: BrowserContextEnvelope | None = None
    parsed: dict[str, Any] | None = None
    updated_at: float = 0.0
    events: list[dict[str, Any]] = field(default_factory=list)

    # ── Public API ────────────────────────────────────────────────────

    def update(self, payload: dict[str, Any] | None, source: str = "extension") -> dict[str, Any]:
        """Replace the cached envelope with a new payload."""
        self.envelope = BrowserContextEnvelope.from_payload(payload)
        self.updated_at = time()
        self.record_event("browser.context.updated", {"source": source, **self.envelope.status()})
        return self.status()

    def update_from_text(self, text: str, source: str = "hook") -> dict[str, Any]:
        """Parse and cache browser context from a conversation message.

        Called automatically by the ``pre_llm_call`` hook when it detects
        a Browser Context Protocol block in the user's message.
        """
        parsed = parse_context_block(text)
        if parsed is None:
            return {"available": False, "reason": "No browser context block found in text."}

        self.parsed = parsed
        self.envelope = BrowserContextEnvelope(
            protocol="hermes.browser.context.v1",
            payload_hash=hash(str(parsed)),
            scope=parsed.get("contextScope", "unknown"),
            active_tab=parsed.get("activeTab", {}),
            summary={
                "title": parsed.get("activeTab", {}).get("title", ""),
                "url": parsed.get("activeTab", {}).get("url", ""),
                "page_text_available": parsed.get("pageTextAvailable", False),
                "selected_text_available": parsed.get("selectedTextAvailable", False),
                "youtube_transcript": parsed.get("youtubeTranscript", False),
            },
        )
        self.updated_at = time()
        self.record_event("browser.context.updated", {"source": source, "scope": self.envelope.scope})
        return self.status()

    def status(self) -> dict[str, Any]:
        """Return whether browser context is currently cached."""
        if not self.envelope:
            return {"available": False, "reason": "No browser context has been captured yet."}
        return {
            "available": True,
            "protocol": self.envelope.protocol,
            "payload_hash": str(self.envelope.payload_hash),
            "scope": self.envelope.scope,
            "updated_at": self.updated_at,
        }

    def get(self) -> dict[str, Any]:
        """Return the full cached context, or an unavailable response."""
        if not self.envelope:
            return {"available": False, "context": None, "reason": "No browser context has been captured yet."}
        return {
            "available": True,
            "context": {
                "protocol": self.envelope.protocol,
                "payload_hash": str(self.envelope.payload_hash),
                "scope": self.envelope.scope,
                "active_tab": self.envelope.active_tab,
                "summary": self.envelope.summary,
                "parsed": self.parsed,
            },
            "updated_at": self.updated_at,
        }

    def clear(self) -> dict[str, Any]:
        """Reset the cached context."""
        self.envelope = None
        self.parsed = None
        self.updated_at = 0.0
        self.record_event("browser.context.cleared", {})
        return self.status()

    def record_event(self, name: str, data: dict[str, Any] | None = None) -> None:
        """Append a timestamped event to the bounded log."""
        self.events.append({"name": str(name), "data": dict(data or {}), "ts": time()})
        # Keep at most 50 events.
        if len(self.events) > 50:
            self.events[:] = self.events[-50:]
