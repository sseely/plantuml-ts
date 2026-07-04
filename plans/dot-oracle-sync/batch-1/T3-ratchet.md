# T3 — Offline parity ratchet for description

## Context

The ratchet is what makes parity monotonic: once a fixture's DOT is in sync,
a regression fails `npm test` — offline, no Java. Precedent:
`tests/oracle/class-dot-parity.test.ts` (harness-health only, keep as is) and
the committed goldens layout `oracle/goldens/<type>/<slug>/{input.puml,
svek-N.dot}` documented in `oracle/README.md`.

## Task

1. Create `oracle/goldens/description/<slug>/` for every description fixture
   that is EQUAL **under the T1-tightened bar** (re-run the report after T1
   lands to get the true set; expect fewer than the 18+1 of the old bar).
   Copy `in.puml` → `input.puml` and `svek-*.dot` from
   `test-results/dot-cache/<type>/<slug>/`.
2. `tests/oracle/description-parity.ratchet.test.ts`: for each goldens slug —
   render `input.puml` with `FormulaMeasurer`, capture seam input via
   `setLayoutInputObserver`, compare against the committed `svek-*.dot` with
   `compareStructural`, assert `structurallyEqual` per graph (and graph count
   matches the number of svek-N.dot files).
3. The test is data-driven: adding a goldens directory adds coverage with no
   code change (that is how loop iterations extend the ratchet).
4. Add a short "description ratchet" note to `oracle/README.md` goldens
   section.

## Read-set

- `tests/oracle/class-dot-parity.test.ts` (pattern), `tests/oracle/svek-dot.ts`
- `scripts/dot-sync-report.ts` (to list the EQUAL slugs)
- `oracle/README.md` (goldens layout)

## Write-set

`oracle/goldens/description/**`,
`tests/oracle/description-parity.ratchet.test.ts`, `oracle/README.md`

## Acceptance criteria

- Given a pinned slug, when its parser/layout regresses structurally, then
  `npm test` fails naming the slug and the failing check.
- Given `npm test` on a clean checkout **without** the oracle jar or
  test-results cache, then the ratchet runs and passes (fully offline).
- Given zero goldens for a type, then the suite skips gracefully (phases 3–5
  reuse the same test shape).

## Quality bar

Four gates; coverage thresholds hold.

## Observability: N/A. Rollback: Reversible.
