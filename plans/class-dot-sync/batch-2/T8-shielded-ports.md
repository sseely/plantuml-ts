# T8 — Shielded/qualifier `:h` edge ports

## Context
A node that is an endpoint of a link with a qualifier (Kal) is "shielded"
(`svek/SvekNode.java:383-396`): emitted via `appendHtml` (`:233-267`) as a
3×3 BORDER=0 wrapper table whose center TD is `FIXEDSIZE + PORT="h"`, and
every edge endpoint at that node gets `:h` appended to its uid
(`svek/Bibliotekon.java:124-133`). Our layout already computes
`shieldedClassifierIds` → `shape: plaintext` and the emitter has a
`shieldTable` branch (`svek-dot-emit.ts:131-136`) — audit both against the
Java, and fix the missing piece: edge endpoints referencing the `:h` port.

## Task
1. Audit: compare our shield detection (does it match `isShielded`'s exact
   rule — endpoint-of-link-with-Kal, per side kal1/kal2?) and the emitted
   wrapper table against `appendHtml` field-for-field.
2. Fix edge emission so edges at shielded nodes carry the `:h` port suffix
   like the oracle. If `DotInputEdge` needs a `tailPort?`/`headPort?` attr,
   add it additively (D3) and emit it in `svek-dot-emit.ts`.
3. Confirm the comparator handles port-suffixed endpoints the same way it
   parses the oracle's (check `parseSvekDot` in `tests/oracle/svek-dot.ts`).

## Write-set
- `src/diagrams/class/class-dot-graph.ts`
- `src/core/graph-layout.types.ts`, `src/core/svek-dot-emit.ts` (additive)
- `tests/unit/**`

## Read-set
- `~/git/plantuml/.../svek/SvekNode.java:233-267,383-396`;
  `svek/Bibliotekon.java:124-133`; `abel/Link.java:219-231,569-575`
- `src/core/svek-dot-emit.ts:117-141`
- `tests/oracle/svek-dot.ts` (comparator endpoint parsing)

## Acceptance criteria
- Given `baneru-00-kuro607` (qualifier fixture from the scope doc), when
  compared, then structurally EQUAL.
- Given the description ratchet + full `npm test`, then green (shared-file
  change is additive).
- Given the report, then EQUAL does not drop anywhere; journal the delta.
- All four gates pass.

## Observability
N/A beyond report delta.

## Rollback
Reversible.

## Commit
`fix(class-dot): shielded qualifier nodes — :h edge ports (Bibliotekon port)`
