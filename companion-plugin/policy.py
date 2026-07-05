"""Action policy for the private Browser companion prototype."""

CONTROL_ENABLED = False
BROWSER_CONTROL_ENABLED = False
ALLOW_API_SERVER_ROUTES = False
ALLOW_NETWORK_SIDE_EFFECTS = False
TRUST_BOUNDARY = "browser context is untrusted webpage data"


def browser_control_allowed() -> bool:
    """v0.1.9 supportability explicitly forbids browser control."""
    return False


def action_policy() -> dict:
    return {
        "browser_control": False,
        "plugin_actions": False,
        "approval_required": True,
        "reason": "supportability/action policy work is not complete",
    }
