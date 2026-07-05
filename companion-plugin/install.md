# Hermes Browser Companion Plugin Prototype

Private prototype skeleton for testing Browser Context Protocol handoff inside a Hermes profile.

## Status

- Fail-soft only.
- No API server route assumptions.
- No browser control.
- No `nativeMessaging`, `debugger`, click/type/form-submit, or navigation actions.
- The Browser Extension must keep prompt-embedded fallback behavior when this plugin is absent.

## Manual prototype install

Copy this directory into a private Hermes profile plugin location only when testing the companion workflow. Do not present this as a public requirement for v0.1.9 users.
