# T6 — Parser wiring B: description, activity, and the small engines

## Context

Same as T5 (read `plans/g0b-annotations/batch-2/T5-parsers-a.md` Context +
the Rule for ALL paragraph — it applies verbatim). This task covers the
remaining engines.

## Task

1. **description** — `src/diagrams/description/`:
   - AST field on `DescriptionDiagramAST` (ast.ts:135).
   - `parser.ts:377-379` ignore `/^(?:skinparam|title|hide|show)\b/i`:
     remove `title`, consult matcher.
   - Legend pre-scan strip: `src/core/descriptive-keywords.ts:218-264`
     (`LEGEND_OPEN_RE` :248 / `LEGEND_CLOSE_RE` :249) — replace stripping
     with matcher consumption (careful: descriptive-keywords is shared —
     check its other consumers via find_referencing_symbols before
     changing semantics; if another engine depends on the strip, keep the
     scan but hand the captured block to annotations instead of discarding).
2. **activity** — `src/diagrams/activity/`: AST field (ast.ts:137); matcher
   before the silent skip at parser.ts:607-610. Activity has multiline
   notes too — same top-level-only rule as sequence.
3. **board, chronology, files, packetdiag, yaml, hcl** — matcher at each
   parser's unknown-line/strip position (hcl currently strips `title` at
   `hcl/parser.ts:322-323` — route to annotations instead). AST fields.
4. **json, dot, chart — parse-side only**: add the AST annotations field
   and route `header/footer/legend/caption` (NOT title) through the
   matcher. Their existing bespoke `title` parsing stays EXACTLY as-is in
   this task (T8 migrates it; two mechanisms must not both consume title in
   the interim — journal this as a known temporary state). Chart's
   `legend <pos>` data-series keyword (chart/parser.ts:143-144) is NOT the
   legend directive — the matcher must not fire on it; chart's own command
   wins (order the matcher AFTER chart's legend command and add a test).

## Read-set

- `plans/g0b-annotations/batch-2/T5-parsers-a.md` (rules)
- `src/core/annotations/index.ts`
- `src/diagrams/description/{parser.ts:370-385, ast.ts:130-140}`,
  `src/core/descriptive-keywords.ts:210-270` (+ its referencers)
- `src/diagrams/activity/{parser.ts:600-615, ast.ts:130-145}`
- `src/diagrams/{board,chronology,files,packetdiag,yaml,hcl}/parser.ts`
  (hcl :315-330), their ast.ts
- `src/diagrams/{json,dot,chart}/parser.ts` (json :100-110, dot :90-100,
  chart :135-150), their ast.ts

## Acceptance criteria

- Given `title X` + `legend…end legend` in a component/usecase fixture, annotations populated, no leakage into entities, and description parse output for annotation-free fixtures deep-equal to main.
- Given chart's `legend right`, chart's data-series legend still works and annotations.legend stays null; given `legend\ntext\nend legend` in chart, annotations.legend is set.
- Given hcl/json/dot titled fixtures, existing rendering behavior UNCHANGED this batch (bespoke title still draws; header/footer/caption now parsed).
- DOT gate exact (component/usecase especially — description parsing changed).
- Every engine's parse is covered by at least one new annotation test.

## Quality bar

Gates green. No renderer files. `descriptive-keywords.ts` change reviewed
against ALL its call sites.

## Observability: N/A.
## Rollback: Reversible.
## Commit: `feat(T6): wire annotation commands into remaining parsers`
