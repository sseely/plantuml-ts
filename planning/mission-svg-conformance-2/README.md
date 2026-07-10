# Mission — SVG conformance, Brief 2: description-engine klimt migration

Migrate the `description` diagram engine to draw through the klimt emitter
(Brief 1) instead of `src/core/svg.ts`, mirroring upstream's draw-call
sequences: the complete `USymbol*` set, svek entity decoration
(`UGroup`/`UComment`), `Cluster`, and `SvekEdge`'s drawing half. Prove it
with a DOT-EQUAL-first fixture ratchet on committed jar goldens, a
PARITY-style corpus dashboard, and overlay triage reports; finish by
retiring the playwright raster visual-QA path. Charter: [`charter.md`](charter.md).

> **Read this file + `decisions.md` before writing code.** D1′–D7 are
> inherited (Brief 1); D8–D12 are settled here (maintainer, 2026-07-09).
> Port verbatim, preserve upstream names (porting discipline).

## Branch
`feature/klimt-description-migration` off `main`. Merge commit (not squash).

## Constraints
**ASK the maintainer (AskUserQuestion), then continue per the answer, when:**
- A task needs to write outside its declared write-set — including any
  `src/**` file another task owns. Request expansion; never silently expand.

**STOP and wait for a human when:**
- Two consecutive quality-gate failures on the same check.
- A decision D1′–D7 / D8–D12 would have to be contradicted to pass.
- DOT parity drops below **357/234/59**. Exception: T4's measurer probe is
  expected to move parity — T4 stops for review if any count *decreases*;
  an increase ratchets the gate value up for later batches (journal it).
- **Divergence sign-off (D5′/D12):** a fixture that cannot be made
  conformant is never pinned loose and the band is never widened. Propose
  an `oracle/accepted-divergences.json` entry (root cause + bound +
  family) — maintainer sign-off required.
- Nondeterminism: any output serializes differently on two runs.
- A D3′-deferred driver (images/sprites/pixel/centered-char/text-as-path)
  is required by a description fixture.
- **T20 precondition:** ratchet coverage at retirement time is narrower
  than what the raster reference set covered — present the gap first.

**PUSH FORWARD with judgment (journal it) when:**
- TS-idiom port mechanics (overloads → unions, name collisions à la
  Brief 1 `fill`→`fillColor`); names/structure stay upstream's.
- File splits where a ported class exceeds the 500-line cap (D2′).
- Which DOT-EQUAL fixtures seed the ratchet in T18 (span symbol families).
- Complexity-hook friction — documented workarounds
  (`decisions.md#repo-conventions-that-bite`).
- TextBlock-seam surface details in T3 (minimal, upstream-named).
- Ambiguous extremity reachability in T13 — include it, journal.

## Quality gates (run between every batch)
| command | pass | on_fail |
|---|---|---|
| `npm run typecheck` | exit 0 | fix_and_rerun |
| `npm test` | exit 0, coverage 90/90/90 | fix_and_rerun |
| `npm run lint` | exit 0 | fix_and_rerun |
| `npm run build` | exit 0 | fix_and_rerun |
| `npx tsx scripts/dot-sync-report.ts class component usecase` | ≥ 357/234/59 EQUAL (see T4 exception) | stop |
| `git diff --name-only` vs task write-set | matches only | ask-to-expand |

From Batch 6 on, the ratchet suite runs inside `npm test`; locked fixtures
may never regress.

## Batches
| # | Focus | Tasks | Status |
|---|-------|-------|--------|
| 1 | [Foundations: seed ∥ metrics ∥ symbol base](batch-1/overview.md) | T1, T2, T3 | [x] |
| 2 | [Jar measurer ∥ USymbol families](batch-2/overview.md) | T4–T9, +T3b | [x] |
| 3 | [svek layer: registry ∥ decoration ∥ cluster ∥ edges](batch-3/overview.md) | T10–T13 | [x] |
| 4 | [EntityImageDescription ∥ survey/dashboard ∥ overlay](batch-4/overview.md) | T14, T15, T16 | [x] |
| 5 | [Renderer cutover](batch-5/overview.md) | T17 | [x] |
| 6 | [Ratchet: infra, then expansion](batch-6/overview.md) | T18, T19 | [x] |
| 7 | [Raster retirement ∥ docs](batch-7/overview.md) | T20, T21 | [x] |

## Mission summary (complete — 2026-07-10)

**Tasks: 22/22 complete** (T1–T21 + inserted T3b). All seven batches `[x]`.

**Outcome.** The description engine (component/usecase/deployment) now
draws entirely through the klimt SVG emitter (T17 cutover), mirroring
upstream's `SvekResult#drawU` order: USymbol families → svek decoration
(`DecorateEntityImage`/`Cluster`/`SvekEdge`+extremities) →
`EntityImageDescription`, with a jar-metrics `jarMeasurer` (D12) and
seed-derived ids. A **dual-measurer** seam (production AWT `jarMeasurer`;
a deterministic `DeterministicMeasurer` injected only for conformance)
lets the corpus be graded in the goldens' own text-mode without
perturbing production output. A **DOT-EQUAL-first SVG conformance
ratchet** now gates inside `npm test`, seeded with **5 zero-diff
fixtures**. The playwright raster visual-QA path is retired (T20); docs
(catalog, `docs/svg-conformance.md`, CHANGELOG) reflect the real state.

**Conformance is partial and honestly tracked.** 0/354 fixtures are
fully zero-diff under production `jarMeasurer` (5 under the deterministic
ratchet path). Remaining work is classified, not silent — F1–F5:
spline-clip edge-drop (3 fixtures); structural features (legend, title/
header, newpage, images, creole); D12 production measurer-mode residue;
multi-leaf document-dimension under-count; and cross-engine unblockers
(named-color→hex table, `transparent` background, `roundCorner`
skinparam) that need a write-set decision. No untracked residue among
DOT-EQUAL fixtures (D5′).

**Gates (final):** typecheck ✓, `npm test` 4640/4640 + coverage
97.7/93.4/98 ✓, lint ✓, build ✓, DOT parity **357/234/60** (usecase
ratcheted up from 59). No decision D1′–D12 contradicted without
maintainer sign-off.

**Decisions flagged for the maintainer (in the journal):** D12 dual-
measurer resolution (locked); the T19 cross-engine write-set ASK list
(deferred as F-follow-ups); three-way concurrent-orchestrator collision
early in the session (resolved — see journal + the `verify-orchestrator-
dead-before-resume` global memory).

**Branch** `feature/klimt-description-migration` is ready for review.
Per the mission branch rule it merges to `main` with a **merge commit
(not squash)** to preserve per-task commit IDs — maintainer's action.

## Index
- [`charter.md`](charter.md) — the pre-planning charter (T7, Brief 1).
- [`decisions.md`](decisions.md) — D8–D12 + inherited decisions + verified facts.
- [`diagrams/component-map.md`](diagrams/component-map.md) — module graph.
- [`diagrams/data-flow.md`](diagrams/data-flow.md) — draw→serialize→compare flows.
- [`decision-journal.md`](decision-journal.md) — appended during execution.

## Sequencing rationale
T1/T2/T3 share no files. USymbol families (T5–T9) need only T3's base; T4
needs T2's table. The registry (T10) needs all families; decoration (T11),
Cluster (T12), and edges (T13) are independent of each other. Assembly
(T14) needs T10+T11; tooling (T15/T16) is file-independent and testable
against the harness alone. The cutover (T17) needs everything upstream of
it. Ratchet infra (T18) needs a working pipeline (T17); expansion (T19)
shares T18's files — sequential. Retirement (T20) is gated on T18/T19
coverage; docs (T21) is independent of T20.
