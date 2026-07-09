# T6 — Emitter conformance suite + divergence-ledger bootstrap

## Context
D4′: the emitter's output must be **fully conformant** — zero diffs at the
0.01 band — against jar-verified golden fragments, for every ported driver.
D5′: any residue is either fixed or becomes a maintainer-signed
accepted-divergence entry; no loose pinning, no untracked residue.

## Task
1. Build golden material under `oracle/goldens/svg-conformance/<case>/`:
   each case = a TS draw sequence (checked-in spec) + `golden.svg` — a
   fragment/document sourced from real jar output (cached
   `test-results/dot-cache/*/*/in.svg`, or regenerated via the local jar if
   a primitive isn't represented). Cover: document preamble; rect (plain +
   rounded); ellipse; line; polygon; path (cubics — the database cylinder
   fragment from the render-fidelity mission is ideal); DotPath spline;
   text (font attrs); comment + group; gradient fill (def + url ref);
   stroke width/dash; deltaShadow if any ported driver emits it.
2. `emitter.golden.test.ts`: for each case, execute the draw sequence
   through `UGraphicSvg`, then `compareSvg(ours, golden, 'deterministic')`
   — assert `pass === true`. On failure the message names the case + first
   diff path. Also assert determinism: two runs, identical strings.
3. Bootstrap `oracle/accepted-divergences.json` as an empty ledger with the
   graphviz-ts schema (id, verdict, maxΔ, class, bound, ref). **Adding an
   entry requires maintainer sign-off — that is a STOP, not a judgment
   call** (README constraint).

## Write-set
- `tests/oracle/svg-conformance/emitter.golden.test.ts`
- `oracle/goldens/svg-conformance/**` (case specs + golden.svg files)
- `oracle/accepted-divergences.json` (empty ledger)

## Read-set
- T1 harness (`tests/oracle/svg-conformance/{normalize,compare}.ts`)
- T5 surface (`src/core/klimt/drawing/svg/u-graphic-svg.ts`)
- Cached jar SVGs; `~/git/graphviz-ts/test/corpus/PARITY.md` +
  `accepted-divergences.json` for the ledger schema
- `../decisions.md` — D4′, D5′

## Acceptance criteria
1. Given every golden case, when the suite runs, then fully conformant
   (pass=true, zero diffs) with no Java and no network.
2. Given a deliberately broken driver (mutation test in-suite or manual),
   then the failure names the case and first diff path.
3. Given two consecutive runs, then byte-identical emitter output.
4. Given the ledger file, then it exists, is schema-valid, and is empty.

## Observability / Rollback
The suite IS the observability (npm test signal). / Reversible.

## Quality bar
Standard gates green. This task closes only when the suite is green AND
every case is fully conformant — partial conformance is a STOP (see
README constraints), not a pinnable state.

## Commit
`test(T6): emitter conformance suite — fully conformant vs jar goldens`
