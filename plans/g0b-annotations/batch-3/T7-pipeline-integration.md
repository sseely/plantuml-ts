# T7 — Pipeline integration: chrome in renderSync/renderBlock + description klimt path

## Context

Everything exists after batches 1-2: plugins return fragments (T3) with
`ast.annotations` populated (T5/T6); `applyChrome` decorates fragments (T4);
styles resolve (T2). This task turns it on, end to end, for every engine.

## Task

1. **`src/index.ts`** — in `renderSync` (:177-209) and the async
   `renderBlock` (:258 area): between `plugin.render` and `assembleSvg`,
   read `ast.annotations` (structural type `{ annotations?:
   DiagramAnnotations }`), resolve styles via T2 (theme + block skinparam +
   `<style>` map — the per-block carriers from SI7 live on
   `BlockUmlOk.preprocessed`; follow how buildTheme already consumes them,
   index.ts:131-160), and call `applyChrome(fragment, annotations, styles,
   measurer)`. Measurer: the SAME instance used for layout
   (`resolveMeasurer`, index.ts:107-111) so conformance runs stay
   deterministic end-to-end.
2. **description/klimt** — `src/diagrams/description/renderer.ts:210-230`
   returns a complete klimt-emitted svg (T3's `AssembledSvg` branch).
   Integrate chrome for description per decisions.md D2: preferred = apply
   the SAME `applyChrome` on a fragment extracted from klimt's emission IF
   `UGraphicSvg`/`SvgGraphicsCore` can emit body-without-document trivially
   (read `src/core/klimt/drawing/svg/u-graphic-svg.ts` + `svg-graphics.ts`
   first); fallback = klimt-native TextBlock decoration inside
   renderDescription using T4's `buildAnnotationBlock` fragments wrapped as
   raw-svg shapes. Either way the GEOMETRY and BLOCKS come from
   `src/core/annotations/` — no third implementation. Journal the choice
   with the evidence. The description SVG ratchet
   (`tests/oracle/svg-conformance/description.golden.ratchet.test.ts`) must
   stay green — its fixtures are annotation-free, so byte-stability (D5)
   guarantees it if the wiring is correct.
3. **conformance census render path** — `tests/oracle/svg-conformance/
   render-fixture.ts` and `scripts/svg-conformance-census.ts` call
   parse/layout/render directly, bypassing index.ts. Wire chrome into that
   path identically (annotations flow through parseDescription's AST), else
   G1 will measure a title-less render. Same for `scripts/
   svg-conformance-census.ts:22` measurer injection.
4. **e2e tests** (`tests/integration/annotations.e2e.test.ts`):
   - `buveco-86-tibo673` (tests/corpus/sequence/buveco-86-tibo673.puml): a
     TIM cascade whose preprocessed content is only `title Test SVG`;
     renderSync must produce a CLASS-typed diagram (SI7 default) whose svg
     CONTAINS the title text `Test SVG` with non-zero document dims.
   - One titled fixture per engine (title above, centered; doc height
     grows; width = max) — assert structurally (text present, y of body
     shifted, dims), not pixel values.
   - legend top/bottom×left/center/right, multiline title, header+footer
     corners, caption — one each on a class diagram, verified against jar
     output relations (run the jar to derive expectations; cite the jar
     svg snippets in comments).
   - annotation-free byte-stability: render 3 corpus fixtures per engine,
     diff against main's output (generate main's outputs FIRST via
     `git stash` or a pre-captured file set; document the method used).

## Read-set

- `src/index.ts:100-260`; `src/core/BlockUmlBuilder.ts:76-150`
- `src/core/annotations/` (T1/T2/T4 contracts)
- `src/core/klimt/drawing/svg/{u-graphic-svg.ts,svg-graphics.ts,svg-graphics-core.ts}` (fragment feasibility — decide, journal)
- `src/diagrams/description/renderer.ts:200-235`
- `tests/oracle/svg-conformance/{render-fixture.ts,description.golden.ratchet.test.ts:20-110}`
- `plans/g0b-annotations/decisions.md#d2` `#d5` `#d8`

## Acceptance criteria

- Given `@startuml\ntitle Hello\nAlice -> Bob : hi\n@enduml`, renderSync output contains `Hello` centered above a sequence diagram; document height = sequence height + title block height (exact per T4 math).
- Given buveco-86-tibo673, output is a class-typed svg containing `Test SVG` (today: no title anywhere) — the mission's named fixture.
- Given every annotation-free ratchet/golden fixture, output byte-identical: full suite passes with zero golden edits.
- Given the DOT gate, EXACTLY 251/259, 81/87, 680/680, 78/80, 260/261.
- Given `npx tsx scripts/svg-conformance-census.ts`, the conformant count does NOT drop below 6 (it may rise); record before/after in the decision journal.

## Quality bar

All gates + DOT gate + census. This is the highest-risk task: if klimt
fragment extraction requires touching `svg-graphics-core.ts` emission
behavior, STOP per the brief's stop conditions and journal the options.

## Observability: N/A (library; the census + ratchet are the instruments).
## Rollback: Reversible.
## Commit: `feat(T7): apply annotation chrome in the render pipeline`
