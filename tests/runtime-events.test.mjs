import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BROWSER_RUNTIME_EVENT_NAMES,
  TOOL_EVENT_NAME_ALIASES,
  browserRuntimeEventName,
  normalizeBrowserRuntimeEvent,
} from '../extension/lib/runtime-events.mjs';

test('browser runtime event names are stable and exclude browser control', () => {
  assert.deepEqual(BROWSER_RUNTIME_EVENT_NAMES, {
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
  assert.equal(browserRuntimeEventName('toolStarted'), 'tool.started');
  assert.equal(browserRuntimeEventName('browser.control.started'), 'runtime.unknown');
  assert.equal(Object.values(BROWSER_RUNTIME_EVENT_NAMES).some((name) => /browser\.control|control\./.test(name)), false);
});

test('normalizeBrowserRuntimeEvent maps current Hermes stream aliases to stable tool event names', () => {
  assert.equal(TOOL_EVENT_NAME_ALIASES['hermes.tool.progress'], 'tool.progress');

  const started = normalizeBrowserRuntimeEvent({
    type: 'hermes.tool.progress',
    data: { tool_name: 'read_file', status: 'started', preview: 'README.md' },
  });
  assert.equal(started.name, 'tool.started');
  assert.equal(started.toolName, 'read_file');
  assert.equal(started.status, 'started');
  assert.match(started.preview, /README/);

  const finished = normalizeBrowserRuntimeEvent({
    type: 'tool.finished',
    data: { name: 'terminal', status: 'completed', preview: 'Authorization: Bearer demo' },
  });
  assert.equal(finished.name, 'tool.finished');
  assert.equal(finished.toolName, 'terminal');
  assert.equal(finished.status, 'completed');
  assert.doesNotMatch(finished.preview, /Bearer demo/);
  assert.match(finished.preview, /Authorization: (?:Bearer \[REDACTED_BEARER\]|\*\*\*|\[REDACTED\])/);
});
