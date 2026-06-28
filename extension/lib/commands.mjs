/**
 * Hermes Browser Extension — Built-in quick commands registry.
 *
 * Each command has a canonical /name, description, category, icon,
 * and a prompt() function that builds the Hermes prompt from context.
 * Commands are available even when the gateway is disconnected.
 *
 * @module lib/commands
 */

/** @typedef {{ name: string, description: string, category: string, icon: string, requiresInput: boolean, promptHint: string, prompt(ctx: import('./common.mjs').CommandContext): string }} CommandDef */

/**
 * All built-in commands, sorted alphabetically by name.
 * @type {CommandDef[]}
 */
export const BUILTIN_COMMANDS = Object.freeze([
  {
    name: 'actions',
    description: 'List interactive elements on this page.',
    category: 'Page',
    icon: '⚡',
    requiresInput: false,
    promptHint: 'List interactive elements (buttons, links, forms) on this page.',
    prompt: (ctx) =>
      `List every interactive element visible on the page "${ctx.activeTab?.title || 'active tab'}". Group them by type (links, buttons, forms, inputs, dropdowns). For each element, describe what it does. Keep the answer ordered and scannable.`,
  },
  {
    name: 'compare',
    description: 'Compare the active tab with other open tabs.',
    category: 'Tabs',
    icon: '⇆',
    requiresInput: false,
    promptHint: 'Compare the active tab against the other open tabs.',
    prompt: (ctx) =>
      `Compare the active tab "${ctx.activeTab?.title || 'active tab'}" with the other ${ctx.tabs.length > 1 ? `${ctx.tabs.length - 1} open tab` : ''}s. Explain how the pages relate to each other, what themes connect them, and what the user's browsing session suggests they are working on. List each tab and its relevance to the active page.`,
  },
  {
    name: 'explain',
    description: 'Explain technical content on this page.',
    category: 'Page',
    icon: '?',
    requiresInput: false,
    promptHint: 'Explain the technical content on this page in simple terms.',
    prompt: (ctx) =>
      `Explain the technical content on the page "${ctx.activeTab?.title || 'active tab'}" in simple terms. Break down the key concepts, jargon, and architecture. If there is code, explain what it does and why it matters. Assume the reader is familiar with general programming but not the specific domain.`,
  },
  {
    name: 'extract',
    description: 'Extract links, emails, code, or data from this page.',
    category: 'Page',
    icon: '✂',
    requiresInput: true,
    promptHint: 'Extract … from this page (links, emails, code, data).',
    prompt: (ctx) =>
      `Extract useful data from the page "${ctx.activeTab?.title || 'active tab'}". List all links in markdown format, detect any email addresses, code blocks, tables, and structured data. Present results organised by type with counts.`,
  },
  {
    name: 'find',
    description: 'Find information about a topic on this page.',
    category: 'Page',
    icon: '⊙',
    requiresInput: true,
    promptHint: 'Find … on this page.',
    prompt: (ctx) =>
      `Search the page "${ctx.activeTab?.title || 'active tab'}" for the user's topic and report everything relevant. Quote specific sections. If the topic does not appear on the page, say so clearly and suggest related topics that do appear.`,
  },
  {
    name: 'summary',
    description: 'Summarise this page in a few paragraphs.',
    category: 'Page',
    icon: '¶',
    requiresInput: false,
    promptHint: 'Summarise the active page in a few clear paragraphs.',
    prompt: (ctx) =>
      `Summarise the page "${ctx.activeTab?.title || 'active tab'}" in a few clear paragraphs. Call out the main purpose, key arguments, conclusions, and anything the reader should notice. Use plain English and keep it scannable with short paragraphs.`,
  },
  {
    name: 'tabs',
    description: 'List all open tabs with their titles and URLs.',
    category: 'Tabs',
    icon: '▦',
    requiresInput: false,
    promptHint: 'List every open tab with title, URL and a short description.',
    prompt: (ctx) =>
      `List every open tab in the current window. For each tab give the title, URL, and a one-line description of what the page appears to be based on its content category. Total: ${ctx.tabs.length} tabs.`,
  },
  {
    name: 'tldr',
    description: 'Too Long; Didn\'t Read — 3 bullet points max.',
    category: 'Page',
    icon: '◆',
    requiresInput: false,
    promptHint: 'TL;DR of this page in 3 bullet points.',
    prompt: (ctx) =>
      `Give a TL;DR of the page "${ctx.activeTab?.title || 'active tab'}" in at most 3 bullet points. Use plain language. No fluff.`,
  },
  {
    name: 'translate',
    description: 'Translate this page content.',
    category: 'Page',
    icon: '🌐',
    requiresInput: true,
    promptHint: 'Translate this page to … (language).',
    prompt: (ctx) =>
      `Translate the visible text content of the page "${ctx.activeTab?.title || 'active tab'}" into the requested language. Preserve markdown-style formatting, code blocks, and link URLs. Output only the translation.`,
  },
]);

/**
 * Cached lookup: command name → CommandDef (lowercased, without leading slash).
 */
const _byName = Object.freeze(
  Object.fromEntries(
    BUILTIN_COMMANDS.map((cmd) => [cmd.name.toLowerCase(), cmd]),
  ),
);

/**
 * Look up a command by its name (with or without leading /).
 * @param {string} name — e.g. "summary" or "/summary"
 * @returns {CommandDef|undefined}
 */
export function getCommand(name) {
  return _byName[String(name || '').replace(/^\//, '').toLowerCase()];
}

/**
 * Return every command that matches a partial input.
 * @param {string} input — e.g. "/sum" or "/summarize"
 * @param {number} [limit=6]
 * @returns {CommandDef[]}
 */
export function suggestCommands(input = '', limit = 6) {
  const needle = String(input || '').replace(/^\//, '').toLowerCase();
  if (!needle) return BUILTIN_COMMANDS.slice(0, limit);
  return BUILTIN_COMMANDS.filter((cmd) => {
    const haystack = `${cmd.name} ${cmd.description}`.toLowerCase();
    return haystack.includes(needle);
  }).slice(0, limit);
}

/**
 * Build the final prompt from a command name + user input + browser context.
 * @param {string}   commandName
 * @param {string}   userInput  — optional extra text after the /command
 * @param {import('./common.mjs').CommandContext} ctx
 * @returns {{ command: CommandDef, prompt: string }|null}
 */
export function resolveCommandPrompt(commandName, userInput, ctx) {
  const cmd = getCommand(commandName);
  if (!cmd) return null;
  let prompt = cmd.prompt(ctx);
  const extra = String(userInput || '').trim();
  if (extra) {
    prompt = `${prompt}\n\nThe user added: ${extra}`;
  }
  return { command: cmd, prompt };
}

/**
 * Parse the input value for a /command token.
 * Returns null if no command is found, or { command, userInput, tail } when one is.
 */
export function parseCommandInput(value = '') {
  const text = String(value || '').trim();
  // Match /command at the start, optionally followed by text
  const match = text.match(/^\/([a-z][a-z0-9_-]*)(?:\s+(.*))?$/i);
  if (!match) return null;
  const [, name, tail] = match;
  const cmd = getCommand(name);
  if (!cmd) return null;
  return { command: cmd, userInput: (tail || '').trim(), tail: tail || '' };
}
