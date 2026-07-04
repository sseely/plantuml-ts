# Architecture Decisions (pre-made, approved)

All five approved by the user during planning. Treat as locked. If a task
discovers a conflicting constraint, STOP and log to `decision-journal.md` — do
not silently override.

## D1 — `DiagramType` union: remove old strings, add `'description'`

Add `'description'`; remove `'component'` and `'usecase'`. They reached the
dispatcher only via `accepts()` (`detectUmlType` returns `'unknown'`), so the
strings are just `plugin.type` tags. Upstream has exactly one type (`DESCRIPTION`).
No aliases. In-tree references update in the same mission (Batch 8).
**Reversible.**

## D2 — `USymbol` table = full `ALL_TYPES`; renderer covers current shapes + fallback

The keyword→symbol map enumerates the **complete** `ALL_TYPES` set (faithful,
total classification + parsing). The renderer implements only the shapes the two
current plugins already draw; not-yet-drawn symbols (person, hexagon, label,
circle, collections, port, action, process, archimate) render as a **rect
fallback** with `// TODO: upstream USymbol<X>`. Missing visuals are explicit
TODOs, never silent drops. **Reversible.**

## D3 — Shared descriptive-signal guard (the dispatch fix)

One helper module `src/core/descriptive-keywords.ts`:
- `DESCRIPTIVE_ONLY_KEYWORDS = ALL_TYPES − {interface, package, actor}` — the
  three keywords class/sequence legitimately parse are excluded.
- `hasDescriptiveSignal(lines)` is true if a block carries any descriptive-only
  keyword **or** a `[...]` / `(...)` element shorthand.
- `class.accepts()` and `sequence.accepts()` return false when
  `hasDescriptiveSignal` is true.

Mirrors upstream's outcome (class/sequence factories fail on `node`/`cloud`/
`usecase`/… lines). Exact exclusions: pure `interface`/`package` block → still
class; bare `actor` + messages → still sequence; `actor` + `(Login)` →
description (caught by the `(...)` shorthand). **Reversible.**

## D4 — Unify layout into one symbol-aware module

One `layout.ts` whose sizing dispatches on `symbol` (stick-figure / ellipse /
box / cylinder / …), not two internal code paths. Upstream has one layout; both
current layouts already feed the graph-layout seam. **Reversible.**

## D5 — Name the engine `description` (mirror upstream `descdiagram`)

`src/diagrams/description/`, `descriptionPlugin`, `type: 'description'`. The
naming-traceability rule favors the upstream name. **Reversible.**

## Rollback classification (whole mission)

**Reversible.** Pure in-process code; revert the merge commit(s). No data
migration, no persisted state, no external contract. Phase 1 and Phase 3 are each
independently revertible.

## Backwards compatibility (in-tree only)

- `plugin.type` and `DiagramType` change (D1) — no external consumers.
- **Binding contract:** rendered SVG for existing component/usecase diagrams must
  stay faithful — enforced by the oracle DOT-gate + migrated per-`USymbol` render
  tests (expectations migrated, never dropped). D2's rect fallback is the only
  approved visual divergence (exotic, not-yet-drawn symbols).
