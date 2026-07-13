# T2 — smetana/vizjs oracle re-capture with pragma stripped

## Context

Maintainer ruling (DIVERGENCES.md § General, `!pragma layout smetana|vizjs`):
those engines ARE graphviz (Java transpile / Emscripten build), so fixtures
carrying the pragma are re-captured with it STRIPPED — the jar then shells
to real graphviz and dumps `svek-N.dot`, moving them from oracle-blind to
comparable. elk fixtures STAY blind (different algorithm, ledgered).

`scripts/dot-sync-report.ts` mechanics (verified): canonical capture writes
`f.markup` at :131; DOT capture writes `in.puml` at :169 then invokes
`java -DPLANTUML_DETERMINISTIC_TEXT=true -DPLANTUML_DUMP_DOT=… -jar
oracle/dist/plantuml-oracle.jar -tsvg …` (:171-175) with a `.done` marker
(:179); the oracle-blind bucket is the `/!pragma\s+layout\s+/i` skip at
:296. Our own render side already ignores the pragma — no port-side change.

Affected slugs (gated types only, 42): class 28 (27 smetana +
siteza-47-lixe343 vizjs), component 5 (gucefa-91-pume734, kofovu-01-niti223,
nuxamo-38-vuxa816, potatu-55-pave291, tojitu-03-ruto643), state 6
(buniva-95-zije634, gimopu-56-rete904, mazize-40-paxi649, mozumu-67-mixa626,
rifefi-73-rofo730, teseci-80-sivi292), usecase 3 (robiga-73-tedi466,
seline-83-vifi756, xoculo-95-fuvi894), object 0. elk slugs (stay blind):
class 7, component 1 (dirofi-81-cuga514), object 1 (robitu-34-vupe367).
Full class list in the mission research; recompute from
tests/visual/data/*.json rather than trusting this table.

## Task

1. Add `stripLayoutPragma(markup: string): string` to dot-sync-report.ts —
   removes lines matching `!pragma layout (smetana|vizjs)` (case-insensitive,
   whole-line); elk lines untouched. Apply at BOTH write sites (:131, :169).
2. Narrow the :296 oracle-blind guard to elk-only
   (`/!pragma\s+layout\s+elk/i`); smetana/vizjs fixtures flow into
   `analyzeFixture`.
3. Invalidate ONLY the affected slugs' cache entries (delete their
   `test-results/dot-cache/<type>/<slug>/` dirs or `.done` markers) and
   re-run the capture for the five gated types. Do NOT touch other slugs'
   cached entries.
4. Run the full report; record per-type EQUAL/comparable/oracle-blind
   before → after. Regenerate `docs/parity-report.md` via the report's
   --markdown path.
5. Verify Trap 3 explicitly (.agent-notes/dot-sync-denominator.md — read
   it): the denominator delta must equal exactly the newly-comparable
   fixture count per type; any other movement = stop and report.
6. Report (do NOT fix) each newcomer's verdict: EQUAL / structural-diff /
   error — with the diverging-check breakdown the report prints. Golden
   additions and backlog entries are T4, not yours.

## Read-set

- `scripts/dot-sync-report.ts` (whole file), `.agent-notes/dot-sync-denominator.md`
- `DIVERGENCES.md` § "`!pragma layout smetana|vizjs`" (:17-48)
- `tests/visual/data/*.json` (recompute the slug lists)
- `docs/parity-report.md` (current numbers)

## Boundaries

- Write ONLY: scripts/dot-sync-report.ts, docs/parity-report.md,
  test-results/dot-cache/** (gitignored, regenerable). Nothing under src/,
  oracle/goldens/, tests/.
- NEVER git checkout/reset/stash/clean; read-only git; do not commit.
- A concurrent agent is writing src/core/klimt/ — irrelevant to you; run
  ONLY the dot-sync-report and `npx tsc --noEmit -p tsconfig.node.json`
  (scripts config) — no full npm test.
- Complexity hook playbook applies to scripts/ too (string-built regexes
  for <>{}, no raw double-quote glyphs, 500-line cap — dot-sync-report.ts
  may already be near it; split a helper module if needed).

## Acceptance criteria

- Given the report after re-capture, oracle-blind per type = the elk-only
  counts; comparable totals grew by exactly the re-captured counts.
- Given a re-captured slug's dot-cache dir, in.puml has NO smetana/vizjs
  pragma line and svek-N.dot EXISTS.
- Given an elk fixture, still oracle-blind, cache untouched.
- Given a previously-comparable fixture, its cached files byte-identical
  (spot-check 3).
- Report table (before/after per type + per-newcomer verdicts) delivered.

## Quality bar: report runs clean end-to-end twice (idempotent — second run all cache hits).
## Observability: N/A. Rollback: Reversible (cache regenerable; script revert).
## Commit: `feat(T2): re-capture smetana/vizjs oracle with pragma stripped` (orchestrator)
