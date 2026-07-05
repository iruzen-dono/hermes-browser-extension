"""Private Hermes Browser companion plugin skeleton.

This package is intentionally fail-soft: it can expose remembered browser
context to Hermes tools/hooks, but it never controls the browser and never
assumes API-server route registration.
"""

from .context_store import BrowserContextStore

__all__ = ["BrowserContextStore"]
