const CONTROL_EVENT_PATTERN = /(^|\.)control(\.|$)|browser\.control/i;
const PREVIEW_LIMIT = 240;

export const BROWSER_RUNTIME_EVENT_NAMES = Object.freeze({
  runStarted: 'run.started',
  runCompleted: 'run.completed',
  assistantDelta: 'assistant.delta',
  assistantCompleted: 'assistant.completed',
  toolStarted: 'tool.started',
  toolProgress: 'tool.progress',
  toolFinished: 'tool.finished',
  approvalRequested: 'approval.requested',
  approvalResolved: 'approval.resolved',
  steerAccepted: 'steer.accepted',
  steerQueued: 'steer.queued',
  sessionReset: 'session.reset',
  subagentFinished: 'subagent.finished',
});

export const TOOL_EVENT_NAME_ALIASES = Object.freeze({
  'hermes.tool.progress': 'tool.progress',
  'tool.call.started': 'tool.started',
  'tool.call.progress': 'tool.progress',
  'tool.call.completed': 'tool.finished',
  'tool.call.finished': 'tool.finished',
  'tool.call.error': 'tool.finished',
});

const EVENT_NAME_SET = new Set(Object.values(BROWSER_RUNTIME_EVENT_NAMES));

export function browserRuntimeEventName(name = '') {
  const raw = String(name || '').trim();
  if (!raw || CONTROL_EVENT_PATTERN.test(raw)) return 'runtime.unknown';
  if (BROWSER_RUNTIME_EVENT_NAMES[raw]) return BROWSER_RUNTIME_EVENT_NAMES[raw];
  const alias = TOOL_EVENT_NAME_ALIASES[raw] || raw;
  return EVENT_NAME_SET.has(alias) ? alias : 'runtime.unknown';
}

function redactEventPreview(value = '') {
  return String(value || '')
    .replace(/Authorization:\s*Bearer\s+[^\n]+/gi, 'Authorization: Bearer [REDACTED_BEARER]')
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED_BEARER]')
    .replace(/(api[_-]?key|token|password|secret)=([^\s&]+)/gi, '$1=[REDACTED]')
    .replace(/Cookie:\s*[^\n]+/gi, 'Cookie: [REDACTED]')
    .replace(/Authorization:\s*(?!Bearer \[REDACTED_BEARER\])[^\n]+/gi, 'Authorization: [REDACTED]')
    .slice(0, PREVIEW_LIMIT);
}

function toolStatusForEvent(name = '', data = {}) {
  const explicit = String(data.status || data.state || '').trim().toLowerCase();
  if (explicit) return explicit;
  if (name === BROWSER_RUNTIME_EVENT_NAMES.toolStarted) return 'started';
  if (name === BROWSER_RUNTIME_EVENT_NAMES.toolFinished) return 'completed';
  return 'progress';
}

function normalizeToolEventName(name = '', status = '') {
  if (name === BROWSER_RUNTIME_EVENT_NAMES.toolProgress) {
    if (/^(started|running|begin|pending)$/i.test(status)) return BROWSER_RUNTIME_EVENT_NAMES.toolStarted;
    if (/^(completed|finished|done|success|error|failed)$/i.test(status)) return BROWSER_RUNTIME_EVENT_NAMES.toolFinished;
  }
  return name;
}

export function normalizeBrowserRuntimeEvent(event = {}) {
  const rawType = String(event.type || event.event || event.name || '').trim();
  const data = event.data && typeof event.data === 'object' ? event.data : event;
  const aliased = TOOL_EVENT_NAME_ALIASES[rawType] || rawType;
  const baseName = browserRuntimeEventName(aliased);
  if (baseName === 'runtime.unknown') {
    return {
      name: 'runtime.unknown',
      rawName: rawType,
      data,
      preview: redactEventPreview(data.preview || data.message || ''),
    };
  }

  const status = toolStatusForEvent(baseName, data);
  const name = normalizeToolEventName(baseName, status);
  const toolName = String(data.tool_name || data.toolName || data.name || data.rawName || '').trim();
  return {
    name,
    rawName: rawType,
    status,
    toolName,
    data,
    preview: redactEventPreview(data.preview || data.detail || data.message || data.input || data.output || ''),
  };
}
