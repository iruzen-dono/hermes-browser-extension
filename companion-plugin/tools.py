"""Fail-soft tool surface for the private Browser companion prototype."""

from __future__ import annotations

from .context_store import BrowserContextStore
from .policy import action_policy

STORE = BrowserContextStore()


def browser_context_status() -> dict:
    status = STORE.status()
    return {"available": False, **status, "policy": action_policy()}


def browser_get_context() -> dict:
    result = STORE.get()
    if not result.get("available"):
        return {"available": False, "context": None, "reason": result.get("reason", "No browser context available.")}
    return result


def browser_clear_context() -> dict:
    return {"available": False, **STORE.clear(), "reason": "Context cleared; no browser control or route side effects were attempted."}


def browser_event_log(limit: int = 20) -> dict:
    safe_limit = max(1, min(int(limit or 20), 50))
    return {"available": bool(STORE.events), "events": STORE.events[-safe_limit:]}
