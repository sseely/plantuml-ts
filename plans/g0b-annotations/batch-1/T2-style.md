# T2 — Annotation style defaults + skinparam / `<style>` plumbing

## Context

plantuml-ts. Upstream styles for the annotation elements come from the
`document{}` block of `~/git/plantuml/src/main/resources/skin/plantuml.skin`
plus skinparam overrides (`FontParam.TITLE/HEADER/FOOTER/CAPTION` +
Legend* params) and `<style>` blocks. plantuml-ts already has
`resolveSkinparam`/`parseStyleBlock` (`src/core/skinparam.ts`) and
`applyStyleMap` (`src/core/style-map-theme.ts`) — this task EXTENDS that
plumbing; do not change key normalisation (it follows upstream
`SkinParam.cleanForKeySlow` — mission-guide warning).

## Task

1. **`src/core/annotations/style.ts`** — `AnnotationStyle` resolution:
   `resolveAnnotationStyles(theme, skinparam, styleMap) →
   { title, caption, header, footer, legend, mainframe }`, each
   `{ fontSize, fontStyle, fontColor, fontFamily, backgroundColor,
   lineColor, roundCorner, padding, margin, horizontalAlignment }`.
   Base defaults verbatim from plantuml.skin lines 1-19 (root: FontName
   SansSerif, FontColor black, FontSize 14, FontStyle plain, RoundCorner 0,
   LineThickness 1.0, LineColor #181818) overlaid with lines 21-66:
   - header: halign right, size 10, color `#8` (gray shorthand — check how
     the jar expands `#8`; grep upstream `HColorSet`/shorthand handling and
     match the jar's emitted rgb), bg transparent, line transparent
   - title: halign center, size 14, bold, Padding 5, Margin 5, line+bg transparent
   - footer: halign center, size 10, color `#8`, bg+line transparent
   - legend: line black, bg `#D`, size 14, RoundCorner 15, Padding 5, Margin 12
   - caption: halign center, size 14, Padding 0, Margin 1, line+bg transparent
   - mainframe (lines 85-89): Padding 1 5, LineThickness 1.5, Margin 10 5
   Padding/Margin follow upstream `ClockwiseTopRightBottomLeft.read` — a
   single number = all four sides; two numbers = `1 5` pattern (check
   `ClockwiseTopRightBottomLeft.java` for the exact 1/2/4-value semantics
   and port them).

2. **skinparam keys** (`src/core/skinparam.ts`): add the upstream-named
   params. Verify the exact key list against
   `net/sourceforge/plantuml/FontParam.java` (TITLE, HEADER, FOOTER,
   CAPTION entries: their default sizes/styles there must agree with the
   skin) and grep upstream for `LegendBackgroundColor|LegendBorderColor|
   TitleFontSize|HeaderFontColor|FooterFontSize|CaptionFontStyle` to
   enumerate real key names. At minimum: Title/Header/Footer/Caption/Legend
   × FontSize/FontColor/FontStyle/FontName, plus LegendBackgroundColor,
   LegendBorderColor, LegendBorderRoundCorner (verify name).

3. **`<style>` selectors** (`src/core/style-map-theme.ts` +
   `parseStyleBlock` if selector grammar needs it): map `title`, `caption`,
   `header`, `footer`, `legend`, `mainframe` element selectors onto the
   AnnotationStyle overrides. Legend's upstream signature is diagram-type-
   specific (`root,document,<type>,legend`) — accept both bare `legend`
   and per-type nesting if `parseStyleBlock` already models nesting;
   otherwise bare `legend` only and journal it.

Priority order: skin defaults < theme < skinparam < `<style>` (match how the
existing theme pipeline layers these for other elements — read
`src/index.ts:131-160` buildTheme flow first and follow the same layering).

## Read-set

- `~/git/plantuml/src/main/resources/skin/plantuml.skin:1-90` (and dark
  overrides :561-576 — record but only wire if the theme system already
  models dark mode)
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/FontParam.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/geom/ClockwiseTopRightBottomLeft.java` (find real path via grep)
- `src/core/skinparam.ts` (key normalisation — DO NOT MODIFY the cleanForKeySlow logic), `src/core/style-map-theme.ts`, `src/core/theme.ts`, `src/index.ts:131-160`

## Interface contract (consumed by T4)

```ts
export interface AnnotationBoxStyle { fontSize: number; fontStyle: 'plain'|'bold'|'italic'; fontColor: string; fontFamily: string; backgroundColor: string|null; lineColor: string|null; roundCorner: number; padding: BoxSides; margin: BoxSides; horizontalAlignment: HorizontalAlignment; }
export interface BoxSides { top: number; right: number; bottom: number; left: number; }
export function resolveAnnotationStyles(...): Record<'title'|'caption'|'header'|'footer'|'legend'|'mainframe', AnnotationBoxStyle>;
```

## Acceptance criteria

- Given no overrides, when resolved, then title = {14, bold, center, padding 5×4, margin 5×4, transparent bg/line} and legend = {14, plain, bg #D-expansion, line black, roundCorner 15, padding 5, margin 12} exactly.
- Given `skinparam TitleFontSize 20`, then title.fontSize = 20; unknown keys unaffected.
- Given `<style> title { FontColor red } </style>` parsed via the existing parseStyleBlock path, then title.fontColor = red and skin defaults remain for other fields.
- Given `skinparam LegendBackgroundColor #FFAA00` AND a `<style>` legend override, `<style>` wins (or matches the layering the existing pipeline uses — assert whichever buildTheme does, and journal the layering you found).
- Unit tests cover every element's defaults + at least one skinparam and one `<style>` override each.

## Quality bar

Gates green; new-code coverage ≥90/90/90; `@see` JSDoc to plantuml.skin /
FontParam origins; no change to existing skinparam test expectations.

## Observability: N/A.
## Rollback: Reversible.
## Commit: `feat(T2): annotation style defaults + skinparam/<style> plumbing`
