# T4 — Chrome geometry + block builders

## Context

plantuml-ts. T1 gave the `DiagramAnnotations` model; T2 gave
`resolveAnnotationStyles`. This task ports the DRAWING half: upstream
`DiagramChromeFactory` (`net/sourceforge/plantuml/core/DiagramChromeFactory.java`),
`DecorateEntityImage` (`net/sourceforge/plantuml/svek/DecorateEntityImage.java`),
`EntityImageLegend`
(`net/sourceforge/plantuml/activitydiagram3/ftile/EntityImageLegend.java:47-55`),
and the bordered-block mechanics of `Style.createTextBlockBordered`
(`net/sourceforge/plantuml/style/Style.java:315-332`) +
`TextBlockBordered.java`. Preserve upstream names.

## Task

1. **Geometry as pure functions** (`chrome.ts`): port DecorateEntityImage's
   math exactly —
   - `mergeTB(a, b)`: width = max, height = sum (XDimension2D.mergeTB)
   - `getTextX(dimText, dimTotal, halign)`: CENTER `(total-text)/2`, LEFT 0,
     RIGHT `total-text` (DecorateEntityImage:144-154)
   - diagram centering: `xImage = (dimTotal.width - dimOriginal.width)/2`
     (:113); top block at y=0, original at `y = dimTop.height`, bottom at
     `y = yImage + dimOriginal.height` (:103-135)
   - stacking order from DiagramChromeFactory.create (:137-149): frame →
     legend → title → caption → header/footer, wrapping successively so
     header/footer are OUTERMOST (title above legend; caption below; then
     header top / footer bottom).

2. **Block builders** (`blocks.ts`): `buildAnnotationBlock(kind, displayLines,
   style: AnnotationBoxStyle, measurer: StringMeasurer) → { body: string,
   width, height }` — an SVG fragment of the bordered block:
   - multiline text laid out line-by-line, measured via the injected
     `StringMeasurer` (decisions.md D4 — creole's 0.6 heuristic forbidden).
     Rich text: reuse the description engine's klimt text path
     (`buildTextBlock(display, textFont, halign)` — see
     `src/diagrams/description/renderer-cluster.ts:31` for the call shape)
     if it can emit a fragment; otherwise emit `<text>`/tspan via
     `src/core/svg.ts` primitives with per-line measurer widths. Journal
     which path you took and why. Creole INLINE markup (bold/color) in
     titles: parse via `parseCreole` for TOKENS but measure/position via
     measurer widths.
   - border/background per TextBlockBordered: padding insets text
     (top/right/bottom/left), dimension = text + padding (+1 each axis,
     TextBlockBordered.java:95-98), rounded rect rx = roundCorner (:149),
     background suppressed when transparent, then margin OUTSIDE the border
     (TextBlockMarged semantics). Title/caption/header/footer default
     transparent border+bg → pure text block with padding+margin; legend
     gets the visible bordered box.
   - klimt: if you need `TextBlockBordered`/raw-fragment support inside
     `src/core/klimt/`, add it under upstream's name; do not modify
     existing emitter behavior.

3. **`applyChrome(fragment: RenderFragment, annotations, styles, measurer)
   → RenderFragment`** — the DiagramChromeFactory.create equivalent
   operating on T3's fragment: skips when `isEmpty(annotations)`
   (byte-stability), else wraps body in translated `<g>`s per the geometry
   above and returns new total dims. Alignment rules (decisions.md D8):
   title/caption forced CENTER; legend per stored halign/valign (add →
   top if TOP else bottom); header/footer per stored halign, defaulting
   header RIGHT / footer CENTER from style when null.

4. **Jar-verify the math**: render minimal fixtures through the jar
   (`java -jar oracle/dist/plantuml-oracle.jar -tsvg -pipe`) —
   `@startuml\ntitle T\na->b\n@enduml` and a legend/header/footer variant —
   and encode the OBSERVED title-block height/width deltas and text x/y as
   unit-test expectations (document dims: total height grows by title block
   height; width = max). Note: jar text metrics are AWT — assert GEOMETRY
   RELATIONS (centering, stacking order, padding/margin arithmetic), not
   absolute text widths.

## Read-set

- The four Java files above (+ `XDimension2D.java` mergeTB)
- `plans/g0b-annotations/decisions.md#d4` … `#d8`
- `src/core/annotations/{model,style}.ts` (T1/T2 outputs)
- `src/core/svg.ts` primitives; `src/core/klimt/shape/TextBlockMarged.ts`,
  `TextBlockUtils.ts`; `src/core/measurer.ts` (StringMeasurer interface)
- `src/diagrams/description/renderer-cluster.ts:20-45` (klimt text-block call shape)

## Interface contract (consumed by T7/T8/T9)

```ts
export function applyChrome(fragment: RenderFragment, a: DiagramAnnotations, styles: AnnotationStyles, measurer: StringMeasurer): RenderFragment;
export function buildAnnotationBlock(kind, lines, style, measurer): { body: string; width: number; height: number };
```

## Acceptance criteria

- Given empty annotations, applyChrome returns the SAME fragment object (===) — zero cost, zero change.
- Given a title on a 100×50 fragment where the title block measures 40×24, then result is 100×74, title text centered at x per getTextX, body translated (0,24); given a title WIDER than the fragment (140×24), result is 140×74 and the body is translated ((140−100)/2, 24).
- Given legend bottom-left + title, stacking is title / body / legend with legend at x=0; given header+footer, they are outermost (header above title, footer below caption/legend).
- Given legend style defaults, the legend fragment contains a rounded rect (rx=15) with bg #D-expansion and black border; padding 5 inside, margin 12 outside; dimensions match TextBlockBordered arithmetic (+1 quirk included).
- Unit tests pin every geometry rule above; jar-derived relation checks documented in the test file with the fixture source inline.

## Quality bar

Gates green; new-code coverage ≥90/90/90; `@see` JSDoc on every ported
function; complexity hooks: use `#lizard forgives` near fn end if a faithful
port trips the complexity gate (never restructure the port to appease it).

## Observability: N/A.
## Rollback: Reversible.
## Commit: `feat(T4): port DiagramChromeFactory/DecorateEntityImage chrome core`
