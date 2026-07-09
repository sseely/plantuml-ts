# T2 — Jar font-metrics extraction → committed data table (D12)

## Context
Jar SVGs carry AWT font metrics (text x positions, `textLength`, node
sizing inputs). Our `StringBounderFixed`-ported table approximates them.
D12: identically mimic the Java metrics. This task produces the data;
T4 builds the measurer on it.

## Task
1. Write a small Java helper (single file, run via the JDK that generated
   the goldens) that prints, as JSON: per-glyph advance widths for
   codepoints 32–591 (Basic Latin + Latin-1 + Extended-A at minimum),
   plus ascent/descent/height, for the font(s) and size(s) the jar uses
   for description diagrams. Determine the actual font upstream uses for
   SVG text (read how the jar picks fonts — grep `SansSerif`/`Verdana` in
   upstream `klimt/font/`; the default skin uses 14 and 12 pt — extract
   at 1pt-normalized or per-size, whichever reproduces AWT rounding
   exactly; verify which before committing to a scheme and journal it).
2. Run it; commit the output as `src/core/measurer-jar.data.ts` (typed
   const, generated-file header naming the JVM + font + command).
3. Keep the helper + a `README.md` with the regeneration command under
   `scripts/extract-jar-font-metrics/`.

## Write-set
- `scripts/extract-jar-font-metrics/**` (Java helper + README)
- `src/core/measurer-jar.data.ts`

## Read-set
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/font/` (StringBounder, UFont — how AWT metrics are obtained)
- `src/core/measurer-width-table.data.ts` (format precedent)
- `../decisions.md#d12`

## Interface contracts (consumed by T4)
```ts
export interface JarFontMetrics {
  family: string; ascent: number; descent: number;
  advances: Readonly<Record<number, number>>; // codepoint → advance @ reference size
  fallbackAdvance: number;
}
```
(Exact shape may follow what AWT rounding requires — journal deviations.)

## Acceptance criteria
1. Given the table, when `advances` is checked for 'W' and ' ' at 14pt,
   then values match `FontMetrics.charWidth` from the extraction JVM
   (record the raw values in the README for spot-verification).
2. Given the generated file, then it typechecks and lints clean and
   carries the regeneration provenance header.
3. Given codepoints outside the table, then `fallbackAdvance` is defined.

## Observability / Rollback
N/A — data. / Reversible (regenerate).

## Quality bar
`npm run typecheck` + `npm run lint` green. No runtime deps added; the
Java helper is dev tooling only, never bundled.

## Commit
`feat(T2): extract jar AWT font metrics to committed data table`
