# Architecture Decisions (approved by maintainer, 2026-07-04)

## D1 — Parity bar: structural + graph attrs; sizes reported

`structurallyEqual` = the existing 7 checks (node count, edge count, degree
sequence, minlen multiset, shape multiset, label/taillabel/headlabel counts,
cluster-size multiset) **plus** `rankdir`, `nodesep`, `ranksep` equality.
Node `width`/`height` remain tolerant metrics (they bake in Java text
measurement, a separate sub-problem) — reported per fixture, tracked as a
median that must not grow. Near-textual DOT equality was considered and
rejected for now (blocked early on label-table internals).

## D2 — Scope: all svek types, phased; DOT-input parity only

description → class(+object) → state → json/dot (after a scoping probe —
upstream may not route json/dot through svek; @startdot's oracle is the input
DOT itself). Activity is out of scope: our engine is ftile-based
(activitydiagram3), not svek. graphviz-ts is out of scope: parity is measured
on the DOT we *feed* the layout engine, so graphviz-ts fidelity is orthogonal.

**graphviz-ts pinning (maintainer directive, 2026-07-04):** its source is
actively changing (algorithm/perf work). Do NOT depend on the live source
dir. Install a packed snapshot into node_modules
(`npm install ../graphviz-ts/graphviz-ts-*.tgz`) and pin it; refresh the
snapshot only as a deliberate, journaled action (or the npm release when it
ships). Current upstream status for context: 100% unit tests, 91.1%
conformance / 97.1% structural similarity on the extreme-graph suite —
remaining deltas are being addressed there. If, after our DOT matches the
oracle, the *rendered layout* still differs, attribute downstream (file it
against graphviz-ts with the offending DOT); do not work around it here.

## D3 — Loop-shaped execution, not pre-enumerated tasks

Divergence categories are discovered by the report, so phases 2–5 are
diagnosis loops governed by loop-protocol.md. Every loop iteration must
produce a diagnosis artifact (mechanism, origin file:line, causal chain,
ruled-out) before any fix — per `~/.claude/rules/diagnosis.md`. No fix without
mechanism.

## D4 — Ratchet: committed goldens + offline vitest

In-sync fixtures are pinned by committing their oracle `svek-*.dot` under
`oracle/goldens/<type>/<slug>/` (existing goldens layout) with the fixture
`.puml`. A vitest (`tests/oracle/*-parity.ratchet.test.ts`) renders each
pinned fixture, captures the seam input, and asserts `structurallyEqual` —
offline, no Java, runs in `npm test`. The corpus-wide report
(`scripts/dot-sync-report.ts`) stays the discovery tool and needs the jar;
it is NOT part of `npm test`.

## D5 — The oracle is the spec; divergence needs sign-off

Bug-for-bug: if the oracle's DOT looks wrong, we match it anyway. Any
deliberate divergence requires maintainer approval + a DIVERGENCES.md entry
(STOP condition). Java source citations (file:line) are required in commit
bodies for semantic fixes.

## D6 — Fix at origin, upstream-shaped

Divergences are fixed where upstream encodes the behavior: parser/AST for
syntax semantics (link length, direction hints, auto-created endpoints),
diagram layout.ts for what gets fed to the seam (clusters, rank hints, graph
attrs), `svek-dot-emit.ts` only for emission-shape gaps. Do not patch the
comparator to be more lenient to gain EQUAL counts.

## D7 — Merge-first branching

`feat/consolidate-description-engine` (complete, green) merges to main via
merge commit before this mission branches. This mission also merges back with
a merge commit (loop iterations reference commit IDs in the journal).
