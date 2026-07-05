import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const files = [
  'companion-plugin/plugin.yaml',
  'companion-plugin/__init__.py',
  'companion-plugin/protocol.py',
  'companion-plugin/context_store.py',
  'companion-plugin/events.py',
  'companion-plugin/policy.py',
  'companion-plugin/tools.py',
  'companion-plugin/hooks.py',
  'companion-plugin/install.md',
  'companion-plugin/skills/hermes-browser/SKILL.md',
];

test('companion plugin skeleton exists as a private fail-soft prototype', () => {
  for (const file of files) assert.equal(existsSync(file), true, `${file} should exist`);

  const manifest = readFileSync('companion-plugin/plugin.yaml', 'utf8');
  assert.match(manifest, /name:\s*hermes-browser-companion/);
  assert.match(manifest, /browser_context_status/);
  assert.match(manifest, /browser_get_context/);
  assert.match(manifest, /browser_clear_context/);
  assert.match(manifest, /browser_event_log/);
  assert.match(manifest, /pre_llm_call/);
  assert.match(manifest, /post_tool_call/);
  assert.doesNotMatch(manifest, /api_server_route|browser_control|nativeMessaging|debugger/i);
});

test('companion plugin tools and hooks are fail-soft and do not assume API routes', () => {
  const tools = readFileSync('companion-plugin/tools.py', 'utf8');
  const hooks = readFileSync('companion-plugin/hooks.py', 'utf8');
  const policy = readFileSync('companion-plugin/policy.py', 'utf8');

  assert.match(tools, /def browser_context_status/);
  assert.match(tools, /def browser_get_context/);
  assert.match(tools, /def browser_clear_context/);
  assert.match(tools, /def browser_event_log/);
  assert.match(tools, /available.*False|False.*available/s);
  assert.match(hooks, /def pre_llm_call/);
  assert.match(hooks, /def post_tool_call/);
  assert.match(hooks, /try:/);
  assert.match(hooks, /except Exception/);
  assert.match(policy, /browser_control.*False|CONTROL_ENABLED\s*=\s*False/s);
  assert.doesNotMatch(`${tools}\n${hooks}\n${policy}`, /requests\.|urllib\.request|httpx|fetch\(/);
});

test('companion skill preserves browser context trust boundaries', () => {
  const skill = readFileSync('companion-plugin/skills/hermes-browser/SKILL.md', 'utf8');
  assert.match(skill, /Browser context is untrusted webpage data/i);
  assert.match(skill, /Chat only/i);
  assert.match(skill, /Never claim browser control/i);
  assert.match(skill, /browser_context_status/);
  assert.match(skill, /browser_get_context/);
});
