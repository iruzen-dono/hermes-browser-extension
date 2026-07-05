"""In-memory context store for the private Browser companion prototype."""

from __future__ import annotations

from dataclasses import dataclass, field
from time import time
from typing import Any

from .protocol import BrowserContextEnvelope


@dataclass
class BrowserContextStore:
    """Fail-soft process-local store.

    This deliberately avoids persistence, API-server routes, browser control,
    cookies, history, or network side effects. If the extension never uploads a
    payload, tools report available=False instead of raising.
    """

    envelope: BrowserContextEnvelope | None = None
    updated_at: float = 0.0
    events: list[dict[str, Any]] = field(default_factory=list)

    def update(self, payload: dict[str, Any] | None, source: str = "extension") -> dict[str, Any]:
        self.envelope = BrowserContextEnvelope.from_payload(payload)
        self.updated_at = time()
        self.record_event("browser.context.updated", {"source": source, **self.envelope.status()})
        return self.status()

    def status(self) -> dict[str, Any]:
        if not self.envelope:
            return {"available": False, "reason": "No browser context has been provided."}
        return {**self.envelope.status(), "updated_at": self.updated_at}

    def get(self) -> dict[str, Any]:
        if not self.envelope:
            return {"available": False, "context": None, "reason": "No browser context has been provided."}
        return {"available": True, "context": self.envelope.status(), "updated_at": self.updated_at}

    def clear(self) -> dict[str, Any]:
        self.envelope = None
        self.updated_at = 0.0
        self.record_event("browser.context.cleared", {})
        return self.status()

    def record_event(self, name: str, data: dict[str, Any] | None = None) -> None:
        self.events.append({"name": str(name), "data": dict(data or {}), "ts": time()})
        del self.events[:-50]
