# ADR-001: Text-measurement fidelity — port PlantUML's deterministic width table and neutralize the oracle

## Status
Accepted (2026-07-05) — resolves mission-index spike **S1**.

## Context

Node `width`/`height` in the svek DOT are computed by PlantUML measuring the
element's label text, then handed to graphviz as `fixedsize`. Our
`FormulaMeasurer` produces different widths than PlantUML's, so the
DOT-oracle-sync bar treats node sizes as a **tolerant metric** (reported, not
asserted). That cap is real: it means no svek type can ever be byte-faithful,
and a sub-pixel size error can flip a structural check (an edge routes one
bezier segment differently, a compress/pack constraint becomes binding). It is
the single ceiling that limits depth on *every* svek type.

graphviz-ts hit the identical problem comparing against native graphviz and
solved it by **neutralizing measurement**: run *both* sides through the same
estimator. Their oracle runs under a headless `GVBINDIR` with no font-layout
plugin, so graphviz falls back to its built-in `estimate_textspan_size`
(`lib/common/textspan_lut.c`); their `EstimateTextMeasurer` is a faithful port
of that same routine, dependency-injected through a one-method `TextMeasurer`
seam at every sizing call site. With both sides measuring identically, node
sizes become **assertable, not tolerant**, and any residual is provably layout,
not font. (See `~/git/graphviz-ts/docs/known-divergences.md`.)

The question S1 asked: does the same move exist for PlantUML, or are we stuck
with a tolerance band?

## Finding

PlantUML has the exact analog of graphviz's `textspan_lut.c`:

- **`UnicodeFontWidthSansSerif.SANS_SERIF`** (`klimt/drawing/font/`, ~717 lines)
  — a `byte[][]` per-Unicode-block, per-codepoint width table in tenths of a
  16 pt reference em. Pure data: no fonts, no AWT, platform-independent.
- **`StringBounderFromWidthTable`** — `width = Σ charWidth(cp) × (size/16)`,
  `charWidth = table[block][cp & 0xFF]/10`, `height = size`. Font-agnostic: it
  ignores the family and always uses the one SANS_SERIF table. Trivial to port.
- **`FileFormat.SVG_DETERMINISTIC`** — on desktop Java (not just TeaVM) routes
  `getDefaultStringBounder` to `StringBounderFromWidthTable`. So the oracle jar
  can be run to measure every label with this exact deterministic table instead
  of AWT font metrics.

This is graphviz-ts's play one-to-one:

| | graphviz-ts | plantuml-ts (this ADR) |
|---|---|---|
| Portable estimator in the reference | `textspan_lut.c` | `UnicodeFontWidthSansSerif` + `StringBounderFromWidthTable` |
| Port it into the TS engine | `EstimateTextMeasurer` | new `WidthTableMeasurer` |
| Force the oracle to use it | headless GVBINDIR (no font plugin) | `SVG_DETERMINISTIC` file format |
| Result | node sizes assertable | node sizes assertable |

## Decision

Adopt the neutralization approach. Reject the roadmap's other two options
(bundle Java AWT font tables; permanent tolerance band) — this is faithful,
deterministic, and matches the pattern already proven in graphviz-ts.

Two deliverables (a follow-on mission, **S1-impl**):

1. **Port the measurer.** Transcribe `UnicodeFontWidthSansSerif.SANS_SERIF`
   verbatim into TS data and implement `WidthTableMeasurer` matching
   `StringBounderFromWidthTable.calculateDimension` exactly (Σ widths × size/16,
   height = size, the `cp ≥ 0xFFFF → 16` and `block ≥ len → 13` fallbacks). It
   implements the existing `StringMeasurer` seam (already DI'd, per the
   `measurer` option), so nothing else changes to adopt it.
2. **Neutralize the oracle.** Re-capture oracle goldens with the jar in
   `SVG_DETERMINISTIC` mode so its DOT node sizes come from the same table.
   The oracle is already a patched jar (`oracle/`, the `dot-output` branch);
   forcing `SVG_DETERMINISTIC` for the dump is within that patch's scope, or a
   CLI/system-property route if one exists.
3. **Tighten the bar.** Once both sides measure identically, move
   `width`/`height` from tolerant (`maxSizeDeltaIn`/`medianSizeDeltaIn`,
   reported) to **asserted** in `compareStructural`, and re-baseline every
   ratchet golden under the new deterministic sizes.

## Consequences

**Easier:**
- Node sizes become assertable → svek depth can reach byte-faithful DOT, not
  just structural. Removes the ceiling on all of A2/A3/A4/A5.
- The seam lets a residual be *proven* measurement-only (feed the port the
  oracle's captured sizes; if layout then matches exactly, the gap was font).
- One table, font-agnostic — no per-family LUT maintenance.

**Harder / risks:**
- Re-baselining: every existing description ratchet golden must be re-captured
  under `SVG_DETERMINISTIC`. Do it as one atomic re-baseline, not per-iteration.
- The width table is SANS_SERIF only. PlantUML's `SVG_DETERMINISTIC` uses it for
  all families too, so this is faithful *to that mode* — but our production
  (non-oracle) output then also measures sans-serif-only. Acceptable: it matches
  what PlantUML's own deterministic mode does. If a future need arises for
  serif/mono fidelity, add tables then (upstream has only this one today).
- `SVG_DETERMINISTIC` may differ subtly from stock `-tsvg` in other ways
  (it is a distinct FileFormat). Verify the DOT *structure* is unaffected by the
  format switch before trusting the re-baseline — only measurement should move.

## Oracle hook — investigated and proven (2026-07-05)

`SVG_DETERMINISTIC` has no CLI flag (it shares the extension "svg"; `-tsvg`
maps to `FileFormat.SVG` via the hardcoded `CliFlag` table). The single
chokepoint for the render's bounder is `FileFormat.getDefaultStringBounder`,
which `CucaDiagramFileMakerSvek.getTextBlock:63` calls to size every svek node.

**Hook (oracle patch `0002-oracle-deterministic-text.patch`, on the fork's
`dot-output` branch):** gate `getDefaultStringBounder` so that under
`-DPLANTUML_DETERMINISTIC_TEXT` it returns `StringBounderFromWidthTable` for
SVG renders. Inert when unset (jar byte-identical to stock). The oracle capture
adds `-DPLANTUML_DETERMINISTIC_TEXT=true` alongside `-DPLANTUML_DUMP_DOT`.

**Proof (end-to-end):**
- The flag changes oracle node sizes to width-table values (babafi: 2.141873→
  1.820660 in, etc.) — deterministic and reproducible.
- **Per-glyph identical:** a controlled 6×`M` delta measured `0.969792 in` on
  *both* the deterministic oracle and `WidthTableMeasurer` at 14 pt — exact to
  six decimals. This also pins PlantUML's default component-label font at 14 pt.
- Residual per-node size gaps are now provably **layout**, not measurement:
  our description layout (a) measures multi-line `\n` labels as one string
  instead of max-line-width × line-count, (b) uses the theme font size rather
  than 14 pt, (c) applies its own box padding / `BOX_MIN_WIDTH`. These are
  ordinary layout-fidelity fixes, isolated by the neutralization.

## Sequencing

S1 is now **resolved** (decision made). **S1-impl** is a normal mission,
unblocked, and should run **before** the class/state/object depth passes
(A2–A4) tighten their bars — otherwise those passes bake in tolerant-size
goldens that S1-impl would then invalidate. Cheapest order: finish A1
(description) structurally, land S1-impl, re-baseline, then A2+ assert sizes
from the start.
