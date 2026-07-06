import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const files = [
  'companion-plugin/plugin.yaml',
  'companion-plugin/__init__.py',
  'companion-plugin/schemas.py',
  'companion-plugin/protocol.py',
  'companion-plugin/context_store.py',
  'companion-plugin/events.py',
  'companion-plugin/policy.py',
  'companion-plugin/tools.py',
  'companion-plugin/hooks.py',
  'companion-plugin/install.md',
  'companion-plugin/skills/hermes-browser/SKILL.md',
];

test('companion plugin files exist', () => {
  for (const file of files) {
    assert.equal(existsSync(file), true, `${file} should exist`);
  }
});

test('plugin.yaml uses standard Hermes plugin format', () => {
  const manifest = readFileSync('companion-plugin/plugin.yaml', 'utf8');
  assert.match(manifest, /name:\s*hermes-browser-companion/);
  assert.match(manifest, /kind:\s*standalone/);
  assert.match(manifest, /provides_tools:/);
  assert.match(manifest, /provides_hooks:/);
  assert.match(manifest, /provides_skills:/);
  // Tools are listed
  assert.match(manifest, /browser_context_status/);
  assert.match(manifest, /browser_get_context/);
  assert.match(manifest, /browser_clear_context/);
  assert.match(manifest, /browser_event_log/);
  // Hooks
  assert.match(manifest, /pre_llm_call/);
  assert.match(manifest, /post_tool_call/);
  // No dangerous capabilities
  assert.doesNotMatch(manifest, /api_server_route|browser_control|nativeMessaging|debugger/i);
});

test('__init__.py registers tools, hooks and bundled skill', () => {
  const init = readFileSync('companion-plugin/__init__.py', 'utf8');
  assert.match(init, /def register\(ctx\)/);
  assert.match(init, /register_tool\(/);
  assert.match(init, /register_hook\(/);
  assert.match(init, /register_skill\(/);
  // Every tool name appears in register_tool calls
  assert.ok(init.includes('browser_context_status'));
  assert.ok(init.includes('browser_get_context'));
  assert.ok(init.includes('browser_clear_context'));
  assert.ok(init.includes('browser_event_log'));
  // Hooks
  assert.ok(init.includes('pre_llm_call'));
  assert.ok(init.includes('post_tool_call'));
});

test('schemas.py defines valid JSON schemas', () => {
  const schemas = readFileSync('companion-plugin/schemas.py', 'utf8');
  assert.match(schemas, /SCHEMA_STATUS/);
  assert.match(schemas, /SCHEMA_GET_CONTEXT/);
  assert.match(schemas, /SCHEMA_CLEAR_CONTEXT/);
  assert.match(schemas, /SCHEMA_EVENT_LOG/);
  // Validate EVENT_LOG schema has limit
  assert.match(schemas, /"limit"/);
});

test('tools return JSON responses — status, get, clear, event_log', () => {
  const tools = readFileSync('companion-plugin/tools.py', 'utf8');
  assert.match(tools, /def browser_context_status/);
  assert.match(tools, /def browser_get_context/);
  assert.match(tools, /def browser_clear_context/);
  assert.match(tools, /def browser_event_log/);
  // Every handler returns json.dumps
  const handlerLines = tools.split('\n').filter(l => l.includes('return json.dumps'));
  assert.equal(handlerLines.length, 4, 'All four handlers should return json.dumps');
  // No hardcoded available:False
  assert.doesNotMatch(tools, /available.*False/);
  // Store integration
  assert.match(tools, /_ensure_store\(\)/);
  assert.match(tools, /set_store\(/);
  // Schemas imported
  assert.match(tools, /from \.schemas import/);
});

test('hooks handle pre_llm_call and post_tool_call safely', () => {
  const hooks = readFileSync('companion-plugin/hooks.py', 'utf8');
  assert.match(hooks, /def pre_llm_call/);
  assert.match(hooks, /def post_tool_call/);
  // Context block parsing
  assert.match(hooks, /UNTRUSTED_BROWSER_CONTEXT_START/);
  assert.match(hooks, /store\.update_from_text/);
  // Safe error handling
  assert.match(hooks, /try:/);
  assert.match(hooks, /except Exception/);
  // Browser context trust boundary
  assert.match(hooks, /browser_context_trust/);
  assert.match(hooks, /untrusted webpage data/);
});

test('context_store parses browser context blocks from prompts', () => {
  const store = readFileSync('companion-plugin/context_store.py', 'utf8');
  assert.match(store, /parse_context_block/);
  assert.match(store, /UNTRUSTED_BROWSER_CONTEXT_START/);
  assert.match(store, /update_from_text/);
  assert.match(store, /BrowserContextEnvelope/);
});

test('events module defines canonical names', () => {
  const events = readFileSync('companion-plugin/events.py', 'utf8');
  assert.match(events, /BROWSER_CONTEXT_UPDATED/);
  assert.match(events, /BROWSER_CONTEXT_CLEARED/);
  assert.match(events, /normalize_event_name/);
});

test('policy prohibits browser control', () => {
  const policy = readFileSync('companion-plugin/policy.py', 'utf8');
  assert.match(policy, /BROWSER_CONTROL_ENABLED\s*=\s*False/);
  assert.match(policy, /CONTROL_ENABLED\s*=\s*False/);
  assert.match(policy, /context_caching.*True/);
  assert.doesNotMatch(policy, /browser_control.*True/);
});

test('companion skill preserves browser context trust boundaries', () => {
  const skill = readFileSync('companion-plugin/skills/hermes-browser/SKILL.md', 'utf8');
  assert.match(skill, /untrusted webpage data/i);
  assert.match(skill, /Chat only/i);
  assert.match(skill, /Never claim browser control/i);
  assert.match(skill, /browser_context_status/);
  assert.match(skill, /browser_get_context/);
  assert.match(skill, /browser_clear_context/);
  assert.match(skill, /browser_event_log/);
});

test('no network imports in companion plugin', () => {
  const tools = readFileSync('companion-plugin/tools.py', 'utf8');
  const hooks = readFileSync('companion-plugin/hooks.py', 'utf8');
  const policy = readFileSync('companion-plugin/policy.py', 'utf8');
  const combined = `${tools}\n${hooks}\n${policy}`;
  assert.doesNotMatch(combined, /requests\.|urllib\.request|httpx|fetch\(/);
});

test('install.md documents the plugin correctly', () => {
  const install = readFileSync('companion-plugin/install.md', 'utf8');
  assert.match(install, /hermes plugins enable hermes-browser-companion/);
  assert.match(install, /v0\.1\.0/);
  assert.match(install, /fail-soft/i);
  assert.ok(install.length > 400);
});
