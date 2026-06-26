# T2 — Class + sequence accepts guard

## Context

The dispatcher (`src/core/dispatcher.ts` `resolve()`) routes `@startuml` blocks
of ambiguous type (`detectUmlType` → `'unknown'`) through each plugin's
`accepts()` in registration order. `class.accepts` matches `/^interface\s/i` and
`sequence.accepts` matches `actor`, so a deployment diagram containing those
keywords is stolen before the descriptive plugin is consulted. Upstream avoids
this because the class/sequence *factories fail* on `node`/`cloud`/`usecase`/…
lines (trial-parse, first-clean-wins). This task reproduces that outcome with the
T1 guard — without rewriting the dispatcher.

## Task

In `src/diagrams/class/index.ts` and `src/diagrams/sequence/index.ts`, import
`hasDescriptiveSignal` from `src/core/descriptive-keywords.ts`. In each plugin's
`accepts(lines)`, return `false` early when `hasDescriptiveSignal(lines)` is
true; otherwise keep the existing pattern logic unchanged.

Add `tests/unit/dispatch/descriptive-guard.test.ts` driving the real registry
(`registry.resolve` via the public path) on representative blocks.

Do not change the dispatcher, registration order, or any other plugin. Do not
remove existing class/sequence accept patterns — only add the guard.

## Read-set

- `src/core/descriptive-keywords.ts` (T1 output — `hasDescriptiveSignal`).
- `src/diagrams/class/index.ts:39-43`, `src/diagrams/sequence/index.ts`
  (`accepts` bodies).
- `src/core/dispatcher.ts:100-114` (`resolve`), to wire the test through the
  registry.
- A `cocice` fixture: `oracle/corpus-cache/class/cocice-*/input.puml` or
  `tests/corpus/**/cocice-*`.

## Architecture decisions

D3 — locked. Guard = `hasDescriptiveSignal`. Exclusions already baked into T1.

## Interface contract

Consumes T1 `hasDescriptiveSignal(lines: readonly string[]): boolean`. Produces
no new exports.

## Acceptance criteria

- Given the `cocice` fixture, when resolved, then plugin type is **not**
  `'class'` (pre-merge it lands on `component`/`usecase`; that is correct here).
- Given a pure `interface Foo` / `interface Bar` block, when resolved, then
  `'class'`.
- Given `actor Bob` + `Bob -> Alice : hi`, when resolved, then `'sequence'`.
- Given `actor Bob` + `(Login)`, when resolved, then not `'sequence'`.
- Given an existing class-diagram fixture (with `class`/relations), when
  resolved, then still `'class'` (no regression).

## Observability

N/A — classification logic; correctness enforced by the regression tests above
(these are the "on-call" detectors for misrouting).

## Rollback

Reversible — revert the two `accepts` edits; guard helper (T1) is inert without
callers.

## Quality bar

`npm run typecheck && npm run lint && npm test` green; full existing suite unaffected.
One commit: `fix(T2): stop class/sequence from claiming descriptive diagrams`.
Body explains the upstream trial-parse rationale.
