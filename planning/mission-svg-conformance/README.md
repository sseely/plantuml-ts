# Mission — SVG conformance, Brief 1: klimt emission core + harness

Port upstream PlantUML's SVG emission stack — the `klimt` drawing model
(`UGraphic` state chain + primitive shapes) and `SvgGraphics` serializer —
into `src/core/klimt/`, plus a near-verbatim port of graphviz-ts's golden
comparison harness (`normalize.ts` + `compare.ts`, 0.01 conformance band).
Deliverable: an emitter whose output is **fully conformant** with the jar's
serialization for every ported primitive, proven by a golden conformance
suite, with the divergence-accounting ledger bootstrapped.

This is Brief 1 of a 2-brief program (maintainer decision “B”, 2026-07-09):
mirroring upstream's emitter beats building an adaptation layer around our
homegrown one. **Brief 2** (charter written by T7) migrates the description
engine to draw through klimt and adds the DOT-EQUAL-first fixture ratchet,
PARITY-style corpus dashboard, and raster-path retirement.

> **Read this file + `decisions.md` before writing code.** D1′–D7 are
> settled. Port sources are cited with line counts in `decisions.md` —
> port verbatim, preserve upstream names (porting discipline).

## Branch
`feature/klimt-svg-emitter` off `main`. Merge commit (not squash).

## Constraints
**ASK the maintainer (AskUserQuestion), then continue per the answer, when:**
- A task needs to write a file outside its declared write-set — including
  any **existing** `src/**` file (this brief only *adds* `src/core/klimt/**`).
  Request the expansion; do not stop, do not silently expand.

**STOP and wait for a human when:**
- Two consecutive quality-gate failures on the same check.
- A decision D1′–D7 would have to be contradicted to make a task pass.
- DOT-parity probe drops below **357/234/59** (klimt has zero consumers this
  brief — a drop means an unauthorized source edit happened).
- **Loose pinning temptation (T6):** a golden that cannot be made fully
  conformant is never pinned loose. Port bug → fix it. Genuinely irreducible
  (e.g. JVM float formatting) → propose an `accepted-divergences.json` entry
  with root cause + bound — **maintainer sign-off required** (D5′).
- Nondeterminism: any golden serializes differently on two consecutive runs.
- A deferred driver (D3′) turns out to be required by the T6 goldens.

**PUSH FORWARD with judgment (journal it) when:**
- TS-idiom mechanics of the port (overloads → unions, etc.); names and
  structure stay upstream's (D2′).
- File-split boundaries inside SvgGraphics (D2′ pre-authorizes the split).
- Choice of jar fragments for T6 goldens (must cover every ported driver +
  gradient fill).
- Complexity-hook friction — apply the documented workarounds
  (`decisions.md#repo-conventions-that-bite`).
- Paint-for-HColor seam details in T2 (direction pre-decided; journal the
  mapping).

## Quality gates (run between every batch)
| command | pass | on_fail |
|---|---|---|
| `npm run typecheck` | exit 0 | fix_and_rerun |
| `npm test` | exit 0, coverage 90/90/90 | fix_and_rerun |
| `npm run lint` | exit 0 | fix_and_rerun |
| `npm run build` | exit 0 | fix_and_rerun |
| `npx tsx scripts/dot-sync-report.ts class component usecase` | 357/234/59 EQUAL | stop |
| `git diff --name-only` vs task write-set | matches only | ask-to-expand |

## Batches
| # | Focus | Tasks | Status |
|---|-------|-------|--------|
| 1 | [Harness ∥ klimt model core](batch-1/overview.md) | T1, T2 | [x] |
| 2 | [Primitive shapes](batch-2/overview.md) | T3 | [x] |
| 3 | [Serializer (Xml stack + SvgGraphics)](batch-3/overview.md) | T4 | [x] |
| 4 | [Drivers + UGraphicSvg](batch-4/overview.md) | T5 | [ ] |
| 5 | [Conformance suite ∥ docs + charter](batch-5/overview.md) | T6, T7 | [ ] |

## Index
- [`decisions.md`](decisions.md) — D1′–D7 + port-source citations + verified facts.
- [`diagrams/component-map.md`](diagrams/component-map.md) — module graph.
- [`diagrams/data-flow.md`](diagrams/data-flow.md) — draw→serialize→compare flows.
- [`decision-journal.md`](decision-journal.md) — appended during execution.

## Sequencing rationale
T1 (harness) and T2 (model core) share no files — parallel. Shapes (T3) need
the model; the serializer (T4) needs shapes; drivers (T5) need both. The
conformance suite (T6) needs the harness + the full emitter; docs/charter
(T7) is independent of T6. Old `svg.ts` coexists untouched — retirement is
the program's final follow-up, after the last renderer migrates.
