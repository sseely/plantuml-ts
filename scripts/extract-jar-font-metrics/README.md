# extract-jar-font-metrics

One-time extraction tool that produces `src/core/measurer-jar.data.ts`, a
per-glyph AWT advance-width table (plus ascent/descent) for the font
PlantUML's SVG string bounders actually use. This is dev tooling only — it
is never bundled (excluded from `npm run lint` and from the vite build;
see the note in `generate-data-table.mjs`).

## Why this exists (architecture decision D12)

A jar-faithful `StringMeasurer` (task T4, not this one) needs text
dimensions that match the upstream jar's SVG output pixel-for-pixel. The
jar measures text via AWT (`java.awt.Font` / `FontMetrics`), which this
repo's TypeScript code has no access to. This tool runs once against a
local JVM, captures the AWT metrics as data, and commits them as a static
TypeScript table — no JVM dependency at runtime or in CI.

## Font and size determination — evidence

- PlantUML's default text family is the Java **logical font `"SansSerif"`**
  — see `net.sourceforge.plantuml.klimt.font.FontStack.SANS_SERIF` and
  `FontParam.FAMILY = "SansSerif"` in the jar's source
  (`~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/font/`).
  `FontStack.getFonts()` resolves it via `Font.decode(name)` — exactly
  what `ExtractJarFontMetrics.java` calls.
- Default font size is **14pt** when no explicit size is set
  (`net.sourceforge.plantuml.style.Style.getUFont()`: `if (size == -1) size
  = 14;`). Description-diagram stereotypes/notes commonly render at 12pt.
  Both sizes are spot-verified below; the committed table itself does not
  need per-size duplication (see next section).

## Extraction scheme: per-point (normalized), not per-size — and why

The jar's SVG string bounders (`StringBounderSvg`, `StringBounderAwt`) both
call `net.sourceforge.plantuml.FileFormat.getJavaDimension(UFont, String)`,
which measures via:

```java
final Font javaFont = font.getUnderlayingFont(text);
final FontMetrics fm = gg.getFontMetrics(javaFont);
final Rectangle2D rect = fm.getStringBounds(text, gg);
```

against a `Graphics2D` (`FileFormat.gg`) built from a dummy
`BufferedImage(100, 100, TYPE_INT_RGB)` with
`RenderingHints.KEY_TEXT_ANTIALIASING` = `VALUE_TEXT_ANTIALIAS_ON` and
`RenderingHints.KEY_FRACTIONALMETRICS` = `VALUE_FRACTIONALMETRICS_ON`.

This means the jar measures with **fractional (non-rounded) advances**,
*not* `FontMetrics.charWidth(int)`'s rounded integers. The extractor
reproduces this exact Graphics2D configuration and calls
`getStringBounds`, never `charWidth`.

Two properties were verified empirically before committing to a per-point
(reference-size-normalized) table instead of one table per font size:

1. **Linear scaling.** `getStringBounds` at any font size equals the
   reference-size (100pt) measurement scaled by `size / 100`, to
   double-precision floating-point epsilon (~1e-15) — see
   `verification.perChar` in the raw JSON (reproduced below). This holds
   because AWT's fractional-metrics glyph advances are `(design units /
   unitsPerEm) * pointSize`, computed independently per derived `Font`, and
   design-unit ratios are fixed per glyph.
2. **Additivity (no kerning).** The whole-string `getStringBounds` width
   equals the sum of each character's individually-measured
   `getStringBounds` width — delta `0.0` for `"Hello World"`, `"AVA"`, and
   `"Type"` at 14pt (see `verification.strings`). AWT applies no kerning
   for this font/rendering configuration (kerning requires an explicit
   `TextAttribute.KERNING` the jar never sets), so a per-glyph table is
   additive-safe for arbitrary strings.

Because of (1), a single per-point table (`advance(1pt)`, i.e. the 100pt
measurement divided by 100) reproduces every font size exactly — no
`referenceSize` field is needed in the `JarFontMetrics` interface; callers
multiply directly by the desired size. This keeps the T4 interface
contract unchanged (see below).

## Interface contract — no deviation

```ts
export interface JarFontMetrics {
  family: string;
  ascent: number;
  descent: number;
  advances: Readonly<Record<number, number>>; // codepoint -> per-point advance
  fallbackAdvance: number;
}
```

`advances`, `ascent`, and `descent` are all **per-point** (i.e. as if
measured at font size 1); multiply by the target font size to get pixels.
`fallbackAdvance` is the arithmetic mean of every measured advance in the
table, used for codepoints outside `[32, 591]`.

## Spot-check values (for manual verification against the raw JSON)

Measured on the extraction JVM (see "JVM used" below), `'W'` = codepoint
87, `' '` = codepoint 32:

| char | codepoint | per-point (1pt) | @ 14pt      | @ 12pt      |
|------|-----------|------------------|-------------|-------------|
| `W`  | 87        | 0.85546875       | 11.9765625  | 10.265625   |
| ` `  | 32        | 0.31640625       | 4.4296875   | 3.796875    |

For contrast, `FontMetrics.charWidth(int)` (the *rounded*, NOT what the jar
uses) returns `12` for `W`@14pt and `4` for ` `@14pt — confirming the
fractional `getStringBounds` value (not the rounded int) is the correct
extraction target.

Ascent/descent at reference size 100: `ascentAtReference = 96.67969`,
`descentAtReference = 21.09375` → per-point `ascent = 0.9667969`,
`descent = 0.2109375` (committed in `measurer-jar.data.ts`).

## JVM used

Extraction must use the same JVM that generated the golden SVG fixtures —
the local default JVM. Recorded at extraction time:

```
$ java -version
openjdk version "21.0.1" 2023-10-17 LTS
OpenJDK Runtime Environment Microsoft-8526870 (build 21.0.1+12-LTS)
OpenJDK 64-Bit Server VM Microsoft-8526870 (build 21.0.1+12-LTS, mixed mode)
```

`os.name` = `Mac OS X`. `Font.decode("SansSerif").getFontName()` reported
literally `"SansSerif"` on this JVM (the physical face behind the logical
name is resolved by the platform font configuration at glyph-rendering
time, not exposed via `getFontName()`) — this is exactly why the table
must be regenerated per-JVM/per-platform rather than hand-maintained, and
why the generated `.ts` file's header records the JVM version + vendor +
OS it came from.

## Regeneration command

From the repo root:

```sh
cd scripts/extract-jar-font-metrics
javac ExtractJarFontMetrics.java -d /tmp/ejfm-build
java -Djava.awt.headless=true -cp /tmp/ejfm-build ExtractJarFontMetrics \
  > /tmp/ejfm-out.json
node generate-data-table.mjs < /tmp/ejfm-out.json \
  > ../../src/core/measurer-jar.data.ts
rm -rf /tmp/ejfm-build /tmp/ejfm-out.json *.class
```

`ExtractJarFontMetrics.java` prints the full JSON (advances, ascent,
descent, and the `verification` block described above) to stdout.
`generate-data-table.mjs` converts that JSON into the committed
`.ts` file — it does not re-derive or re-measure anything, it only
formats.

To inspect the raw JSON (e.g. to re-run the spot-checks above) without
generating the `.ts` file, stop after the `java` step and read
`/tmp/ejfm-out.json` directly.
