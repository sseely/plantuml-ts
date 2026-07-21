# G5 ledger

## C0 — harness stand-up, corpus-wide characterization, jar-verified
## diagnosis (mechanism found: caller font-size bug, NOT a measurer defect)
## -- 0 fixtures changed (no in-scope fix exists), gates verified unchanged

### Harness

`scripts/measurer-calibration-report.ts` (new). Walks every cached golden
`in.svg` under `test-results/dot-cache/<type>/<slug>/` for all seven
corpus types (`component usecase class object state dot json`), extracts
every `<text textLength="...">` element (jar's own measured width for
exactly that string at exactly that font — captured under
`-DPLANTUML_DETERMINISTIC_TEXT=true`, per `src/core/measurer-
deterministic.ts`'s own doc comment), and measures the SAME string at the
SAME font attrs through `WidthTableMeasurer` (the `DeterministicMeasurer`
re-export, used by every conformance/ratchet script), `jarMeasurer`
(production's D12 AWT table), and `FormulaMeasurer` (the
`StringBounderFixed` approximation). Buckets % error by
`type|size|weight|style`; prints top-N worst individual samples per
measurer.

**Scope exclusions found and applied** (both discovered by investigating
this script's own first-run "worst sample" output, not assumed up front):

- `elk-layout` (79 samples, 8 fixtures): any fixture whose `in.puml`
  contains `!pragma layout elk` routes through
  `CucaDiagramFileMakerElk.java` — an entirely separate upstream layout
  engine from the svek/graphviz pipeline this port implements. Found by
  tracing `component/dirofi-81-cuga514`'s outlier `"E"` sample
  (`textLength=7.5879` vs the other 23 corpus occurrences of the same
  string/size/weight, all `9.3625`) back to its `in.puml`'s first line.
- `json-diagram` (102 samples, 5 fixtures): `@startjson` diagrams render
  synthetic placeholder/summary text through the JSON engine's own sizing
  path, not the shared svek pipeline (e.g. `"{ ... }"` is a literal
  collapsed-value placeholder the renderer emits, not user content).

### Part A result: the measurer is jar-exact

After excluding the two out-of-scope classes, 13,564 in-scope
`font-family="sans-serif"` samples remain. `WidthTableMeasurer`'s error
across essentially the ENTIRE corpus is **0.000% mean / ≤0.001% max**
(floating-point rounding only) — see every bucket in
`plans/g5-measurer-calibration/README.md`'s referenced report run; full
raw output is reproducible via `npx tsx scripts/measurer-calibration-
report.ts`. Two residual clusters remain, both narrow and NOT connected to
the S13 founding evidence's mechanism:

- `component | size=14 | weight={normal,bold}` (mean 3.77% / 0.35%): 1392
  of these samples come from ONE fixture, `component/gutute-00-gaki684`
  (a `!pragma svek_trace on` stress-test, 9075px tall, deeply nested
  `protocol X { C1 C2 ... }` port declarations) — a small, growing-with-
  string-length divergence (`"C1"` -3.25%, `"C10"` -6.08%) for PORT
  labels specifically. Ruled out: SVG-level `transform`/`scale` (0 matches
  in the file); the `svek_trace` pragma itself (`grep -rn svek_trace
  ~/git/plantuml/src/main/java/net/` — ZERO matches in current upstream
  source, so the pragma is unrecognized/no-op and cannot be the
  mechanism). NOT root-caused further this iteration — see README's "Next
  iteration" item 3.
- Two single-sample anomalies (`component/kokebo-27-vafi688`'s `"b"`
  after a `remove $a` directive; `component/zosuje-43-zebi775`'s
  `"±5px..."` containing a Latin-1 Supplement codepoint) — each 1 sample
  in a 265-fixture corpus, not investigated further (below the mission's
  evidence bar for a dedicated diagnosis).

`jarMeasurer` (production's D12 AWT table) shows the LARGE, EXPECTED,
pre-existing "apples to oranges" gap against the deterministic-mode
oracle (mean errors up to 27% per bucket, worst single sample 199%,
`class/cotacu-63-jisi866`'s `"PERIOD ... Date"`) — this is the documented
dual-measurer architecture decision (2026-07-10, `measurer-
deterministic.ts`'s own header), not a defect: production never claims to
match the deterministic-mode textLength.

### Part B: call-site font-size audit — the real mechanism

Cannot be derived from the oracle SVGs (they report the jar's OWN
correct font size for whatever text role it is, not what THIS PORT'S
call site chose) — derived by reading every edge/relationship-label
`FontSpec` construction directly and comparing against upstream's
`FontParam` enum (`~/git/plantuml/.../klimt/font/FontParam.java:54`):
`ARROW(13, normal)`, distinct from body/entity-name defaults
(`STATE(14, normal)`, `COMPONENT(14, normal)`, etc.).

| Diagram engine | Call site | Uses | Should use | Status |
| --- | --- | --- | --- | --- |
| state | `state-dot-graph.ts:179` | `theme.fontSize` (14) | 13 | MISMATCH |
| state | `state-composite-pass.ts:244` | `theme.fontSize` (14) | 13 | MISMATCH |
| state | `state-composite-pass.ts:326` | `theme.fontSize` (14) | 13 | MISMATCH (this is the S13 `EvNewValueSaved` call site) |
| state | `state-composite-cluster.ts:36` (`measureClusterTitle`) | `theme.fontSize` (14) | 14 | CORRECT — this is composite TITLE text (body-sized), not an edge label; flagged for verification then confirmed by reading its only caller |
| class/object | `class-dot-graph.ts:298` (`labelFont`) | `theme.fontSize` (14) | 13 | MISMATCH — documented as a KNOWN, deliberately-unfixed gap in `class-layout-helpers.ts:96-100` ("left untouched to avoid ANY risk to the frozen DOT gate") |
| class/object | `class-layout-helpers.ts:102` (`CARDINALITY_FONT_SIZE`) | 13 (constant) | 13 | CORRECT — proves the fix pattern is already established in this SAME file |
| component/usecase | `description/layout.ts:735` (`fontSpec`, LAYOUT-time) | `theme.fontSize` (14) | 13 | MISMATCH |
| component/usecase | `description/renderer-edge.ts:21` (`ARROW_LABEL_FONT_SIZE`, RENDER-time) | 13 (constant) | 13 | CORRECT — comment cites the exact prior fix ("G1 I2 finding: a prior `theme.fontSize - 2` ... diverges from the jar the moment `theme.fontSize` differs from 14") |

### Diagnosis (per diagnosis.md — mechanism, origin, causal chain, ruled out)

**Mechanism.** Five call sites across three diagram engines (state,
class/object, description) construct the `FontSpec` for arrow/transition/
relationship edge-label text using `theme.fontSize` (14, the body/entity-
name default, matching upstream `FontParam.STATE`/`FontParam.COMPONENT`)
instead of upstream's `FontParam.ARROW` default (13). The measurer these
call sites feed (`WidthTableMeasurer`) is not at fault — it returns the
mathematically correct width for whatever `(text, size)` pair it
receives; the bug is that these call sites hand it `size=14` for text the
jar renders at `size=13`.

**Origin.** `src/diagrams/state/state-composite-pass.ts:326` (the exact
S13 `EvNewValueSaved` sample): `const font: FontSpec = { family:
ctx.theme.fontFamily, size: ctx.theme.fontSize };` — `ctx.theme.fontSize`
resolves to `theme.ts:842`'s `fontSize: 14` default. Parallel origins:
`state-dot-graph.ts:179`, `state-composite-pass.ts:244` (state);
`class-dot-graph.ts:298` (class/object, ALREADY flagged as a known,
deliberately-deferred gap in that file's own neighboring comment);
`description/layout.ts:735` (component/usecase, LAYOUT side only — the
RENDER side, `description/renderer-edge.ts:21`, was already fixed for
this exact bug class under an earlier mission, "G1 I2").

**Causal chain.** `WidthTableMeasurer.measure("EvNewValueSaved", {size:
14})` = 120.0500px (jar-verified exact match to S13's own reported
value, confirmed directly: `npx tsx` probe against `src/core/measurer.ts`
gives `111.4750` at `size:13` and `120.0500` at `size:14` — the EXACT two
numbers S13 cited as "ours" (120.05) and "jar's real" (111.475)).
`state-composite-pass.ts:326` feeds `size: theme.fontSize` (14) into
`buildEdgeAttrs` → `state-composite-edge-label.ts#edgeLabelAttrs` →
`measurer.measure(text, font)`, producing the oversized 120.05 width that
then feeds graphviz's own label-reservation/positioning calculation
(`labelWidth` on the DOT edge attribute), shifting `labelX` and
compounding into S13's observed ~10.6px right-edge divergence on the real
rendered label box. The jar itself renders this SAME text at `size=13`
(confirmed directly from `test-results/dot-cache/state/bemena-23-
zebu249/in.svg`: `<text ... font-size="13" ... textLength="111.475"
...>EvNewValueSaved</text>`), matching upstream's `FontParam.ARROW(13,
normal)` default exactly.

**Ruled out** (in order investigated):

1. **Measurer table transcription error** (per-codepoint width values
   wrong in `measurer-width-table.data.ts`) — ruled out by the corpus-wide
   sweep: 13,564 in-scope samples at 0.000% mean error across every
   observed size/weight/style. A transcription error would show up as a
   PERSISTENT per-codepoint bias regardless of context; none was found for
   any codepoint that appears meaningfully often in the corpus.
2. **RLE/fallback decode bug** (the specific defect `measurer-
   deterministic.ts`'s own doc comment records as ALREADY fixed under an
   earlier mission, S1-impl/ADR-001) — ruled out as the CURRENT cause: the
   fix is present in the current `measurer.ts` (`charWidth`'s two fallback
   branches), and this iteration's sweep found no astral-codepoint or
   block-overflow divergence in the corpus.
3. **Weight/style handling in `WidthTableMeasurer`** — considered because
   `WidthTableMeasurer.measure` never reads `font.weight`/`font.style` at
   all (confirmed by reading the class body: only `font.size` is used).
   Ruled out as a defect, not a bug: `StringBounderFromWidthTable`
   (deterministic mode) is genuinely weight/style-INVARIANT in the real
   jar too — confirmed by the corpus-wide sweep showing 0.000% mean error
   for EVERY `weight={normal,bold} × style={normal,italic}` combination
   once `size` is held correct; if the jar's deterministic table varied by
   weight/style, those buckets would show a mismatch and none do.
4. **SVG-level scale/transform corrupting the extracted `textLength`**
   (considered for both the ELK outlier and the `gutute-00-gaki684`
   secondary finding) — ruled out for both: `grep -o 'transform=' /
   scale('` on each fixture's `in.svg` returns zero matches; `viewBox`
   matches `width`/`height` exactly in both cases (no implicit scaling).
5. **`!pragma svek_trace on` as the `gutute-00-gaki684` mechanism** —
   ruled out: `grep -rn svek_trace ~/git/plantuml/src/main/java/net/`
   returns zero matches in current upstream source; the pragma is
   unrecognized (a no-op) and cannot be causing a rendering-path
   difference. The TRUE mechanism for that fixture's small, real, port-
   label-specific divergence is UNRESOLVED (see README's "Next iteration"
   item 3) — not chased further, low corpus impact (1/265 component
   fixtures), unrelated to the S13 mechanism.

### Fixture impact

**0 fixtures changed.** No fix landed — no in-scope fix exists (see
"Calibrate" below). `oracle/goldens/svg-*/**` untouched; `oracle/goldens/
state/size-backlog.json` untouched (103 entries, unchanged); `tests/
oracle/svg-conformance/parity-*.json` untouched (no `svg-parity-
survey.ts` regen run — nothing to regenerate against, since no measurer
or layout code changed).

### Calibrate — no in-scope fix exists (scope conflict, logged per
### autonomous-execution.md STOP condition)

Task 3 ("land fixes TDD-first for each bounded mechanism") presupposed a
MEASURER defect. Part A conclusively shows there is none: `WidthTable
Measurer` is jar-exact. The actual mechanism (Part B) is a wrong
`FontSpec.size` at FIVE call sites in `src/diagrams/state/*.ts`,
`src/diagrams/class/class-dot-graph.ts`, and
`src/diagrams/description/layout.ts` — all outside this iteration's
write-set (`src/core/** measurer/font-metrics modules only`). Per
`~/.claude/rules/autonomous-execution.md`'s STOP conditions ("A task
requires modifying files outside its declared write-set AND those files
aren't in any other task's write-set either"), C0 made ZERO changes to
any `src/` file this iteration. See `decision-journal.md` for the logged
decision and README's "Next iteration" section for the recommended fix
(a constant matching the ALREADY-PROVEN-SAFE `CARDINALITY_FONT_SIZE` /
`ARROW_LABEL_FONT_SIZE` pattern already present twice in this codebase).

### Gates (C0, verified before AND after — identical, since 0 `src/`
### files were touched)

- `npm run typecheck`: clean (both configs).
- `npm run lint`: clean.
- `npm test -- --run`: **10128/10128** passing (377 files).
- DOT gate: `component 262/262 - usecase 90/90 - class 708/708 - object
  78/80 - state 267/267` — unchanged from the mission brief's stated
  frozen baseline.
- `state-dot-parity.test.ts` (size-backlog ratchet): **268/268**.
- `description.golden.ratchet.test.ts`: **51 tests**.
- `class.golden.ratchet.test.ts`: **305 tests**.
- `object.golden.ratchet.test.ts`: **24 tests**.
- `state.golden.ratchet.test.ts`: **54 tests**.
- Censuses: description (no-arg) **48/355**, class **303/718**, object
  **22/80**, state **52/271** — all match the mission brief's stated
  baseline exactly.
- `oracle/goldens/state/size-backlog.json`: **103 entries**, byte-for-byte
  unchanged (`git status --short` confirms — only `scripts/measurer-
  calibration-report.ts` is new/untracked).

### Ratchet / pins

**0 new pins.** No fixture reached zero-diff-and-dotEqual this iteration
(no code changed that could move any fixture).

### C1+ queue

See README's "Next iteration — recommended scope" (three items: primary
font-size fix requiring write-set expansion; re-attempt readiness for the
parked edge-label-ink mechanism once the fix lands; the unresolved
secondary `gutute-00-gaki684` port-label finding).
