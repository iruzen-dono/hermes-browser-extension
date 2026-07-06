"""JSON Schema definitions for Hermes Browser companion plugin tools."""

SCHEMA_STATUS = {
    "type": "object",
    "properties": {},
    "additionalProperties": False,
}

SCHEMA_GET_CONTEXT = {
    "type": "object",
    "properties": {},
    "additionalProperties": False,
}

SCHEMA_CLEAR_CONTEXT = {
    "type": "object",
    "properties": {},
    "additionalProperties": False,
}

SCHEMA_EVENT_LOG = {
    "type": "object",
    "properties": {
        "limit": {
            "type": "integer",
            "description": "Maximum number of recent events to return (1–50, default 20).",
            "minimum": 1,
            "maximum": 50,
        },
    },
    "additionalProperties": False,
}
