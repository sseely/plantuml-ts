/**
 * Deterministic string measurer (dual-measurer conformance/ratchet seam).
 *
 * The conformance oracle corpus (`test-results/dot-cache/**\/in.svg`) is
 * captured with PlantUML's jar run under `-DPLANTUML_DETERMINISTIC_TEXT=true`
 * (`FileFormat.SVG_DETERMINISTIC`), which routes ALL text measurement
 * through `StringBounderFromWidthTable` — a completely different
 * text-metric system from the AWT font metrics `jarMeasurer` (D12)
 * reproduces for production. Two different metric systems can never agree
 * pixel-for-pixel, so comparing production (AWT) output against the
 * deterministic-mode oracle can never reach zero-diff on text-sized
 * geometry, no matter how faithful the rest of the port is.
 *
 * Maintainer decision (DUAL MEASURER, decision-journal 2026-07-10):
 * production keeps `jarMeasurer` (D12 intact — real-AWT fidelity is the
 * product). A SEPARATE deterministic measurer is injected ONLY for the
 * conformance/ratchet render path, so that path measures text in the SAME
 * system the oracle used to produce its goldens — making node/text geometry
 * assertable instead of perpetually tolerant.
 *
 * This module does not re-port `StringBounderFromWidthTable` +
 * `UnicodeFontWidthSansSerif` a second time — that port already exists as
 * `WidthTableMeasurer` (`measurer.ts`, backed by `measurer-width-table.data.ts`),
 * built and jar-verified under an earlier mission (ADR-001, "S1-impl").
 * Duplicating ~717 lines of width-table data a second time under a new name
 * would violate this project's own no-duplicate-logic principle for zero
 * benefit — `WidthTableMeasurer` IS `StringBounderFromWidthTable`, verbatim.
 * This module re-exports it under the `DeterministicMeasurer` name the
 * dual-measurer mission brief specifies, as the stable import path the
 * conformance/ratchet scripts (`scripts/dot-sync-report.ts`, the SVG
 * conformance census) are expected to use.
 *
 * Re-verified against the real jar (2026-07-10, `-DPLANTUML_DETERMINISTIC_TEXT=true`,
 * `plantuml-1.2026.7beta3.jar`, openjdk 21.0.1) as part of this task's own
 * charter to verify the port, not just trust the prior mission's tests:
 *
 *   | text          | size | jar textLength | DeterministicMeasurer width |
 *   |---------------|------|-----------------|------------------------------|
 *   | "Component"   | 14   | 72.3625         | 72.3625 (exact)              |
 *   | "comp1"       | 14   | 42              | 42 (exact)                   |
 *   | "A"           | 14   | 9.3625          | 9.3625 (exact)                |
 *   | "\u{1F600}"   | 14   | 14              | 14 (exact, AFTER this task's |
 *   |               |      |                 | getCharWidth fallback fix)   |
 *   | "Ａ"      | 14   | 11.375          | 11.375 (exact, AFTER fix)    |
 *
 * The last two rows caught a real, pre-existing divergence in
 * `WidthTableMeasurer.charWidth`'s two fallback branches (`cp >= 0xFFFF`,
 * `block >= table.length`): they divided the raw upstream literals (16, 13)
 * by 10, but `StringBounderFromWidthTable.getCharWidth`'s own fallback
 * branches do NOT divide (only `UnicodeBlock.getWidth`'s normal path does)
 * — verified against the jar and fixed in `measurer.ts` as part of this
 * task (see that file's `WidthTableMeasurer.charWidth` doc comment).
 */
export { WidthTableMeasurer as DeterministicMeasurer } from './measurer.js';
