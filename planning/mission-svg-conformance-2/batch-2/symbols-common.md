# Common spec — USymbol family tasks (T5–T9)

Each family task ports its class list from
`~/git/plantuml/src/main/java/net/sourceforge/plantuml/decoration/symbol/`
to `src/core/decoration/symbol/` (D9/D10). This spec is the shared body;
the per-task entry in `overview.md` gives the class list and write-set.

## Porting rules
- One file per upstream class, name verbatim (`USymbolCloud.ts`).
- Port the draw sequences faithfully: the exact `UPath`/`URectangle`/
  `UEllipse`/`UPolygon`/`ULine` construction, coordinate math, magic
  constants, `SymbolContext` application order, `deltaShadow` handling,
  and title/stereotype TextBlock placement math. Do not simplify paths
  or merge similar branches — bug-for-bug (project charter).
- Consume T3's base (`USymbol`, `SymbolContext`, TextBlock seam) — do
  not reshape it; if it is genuinely missing something a symbol needs,
  ASK (write-set expansion) rather than adding side channels.
- Where a symbol reads skin/style values Brief 2 doesn't carry, take the
  value EntityImageDescription passes in (T14 read-set shows the call
  shape) — journal each such seam.
- Overload collapsing and other TS mechanics: fine, journal once per task.

## Conformance assertion (every symbol)
At least one test per symbol renders the symbol standalone through
`UGraphicSvg` and asserts `compareSvg(ours, jarFragment,
'deterministic').pass === true` where `jarFragment` is extracted from a
cached jar SVG (`test-results/dot-cache/{component,usecase}/*/in.svg`) or
jar-generated (`~/git/plantuml/build/libs/plantuml-1.2026.7beta3.jar`,
provenance in a comment). NEVER generate the reference from our own
emitter. Wrap fragments in identical minimal documents on both sides
(Brief 1 T6 precedent: `oracle/goldens/svg-conformance/database-cylinder-dashed/`).

## Quality bar (all family tasks)
- `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` green;
  new modules ≥90/90/90.
- Complexity hook: files ≤500 ln (Cloud may exceed — split per D2′,
  journal), funcs ≤30 NLOC / CCN ≤10, `#lizard forgives` near function
  END when a faithful port exceeds limits, string-built regexes for
  `<>{}|` classes.

## Commit (one per task)
`feat(TN): port USymbol <family> draw sequences` — body cites the
upstream classes with line counts.
