# T4 — Serializer: XmlWriter stack + SvgGraphics

## Context
`SvgGraphics.java` (1,267 ln) is upstream's SVG document builder: it owns
the root element + preamble, `<defs>`, gradient registration, group/comment
emission, and the element-creation methods every driver calls
(`svgEllipse`, `svgRectangle`, `svgPath`, `text`, …). It writes through a
small XML node stack (`XmlWriter` 285 ln + `XmlDocument`/`XmlNode`/`XmlLeaf`
~350 ln). Conformance (D4′) is decided here: attr names, ordering, number
formatting, and preamble must match the jar's serialization.

## Task
Port to `src/core/klimt/drawing/svg/`:
1. `xml-writer.ts` — the Xml* stack (writer, document, node, leaf). This is
   a string-building layer; keep its escaping and attr-emission order
   faithful.
2. `svg-graphics.ts` (+ 1–2 physical splits per D2′, e.g.
   `svg-graphics-elements.ts`, re-exported so the surface is one
   upstream-named `SvgGraphics` class): document lifecycle (preamble per the
   sample in `../decisions.md#verified-facts` — root attrs incl.
   `data-diagram-type`, `style="width:…px;height:…px;background:…;"`,
   `zoomAndPan`, `preserveAspectRatio`, `contentStyleType`, the
   `<?plantuml $version$?>` PI, `<defs/>`, root `<g>`); per-element creation
   methods with upstream attr ordering; **number formatting faithful to
   SvgGraphics.java** (its decimal formatting, not JS default `toString` —
   verify against the Java and cached jar SVGs; this is where conformance
   dies if sloppy); gradient def registration (`<linearGradient>` ids —
   upstream's seed-counter scheme, journal the id policy vs our paint.ts
   content-hash scheme; upstream's wins inside klimt); comment + group
   (`UGroup` types → `<g>` attrs) emission.
3. **Deferred surface (D3′):** interactive/link (`openLink`), images,
   sprites — throwing stubs naming D3′.

## Write-set
- `src/core/klimt/drawing/svg/{xml-writer,svg-graphics}.ts` (+ splits)
- `tests/unit/core/klimt/svg-graphics.test.ts`

## Read-set
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/drawing/svg/SvgGraphics.java` (all 1,267 — read fully before writing)
- `.../svg/{XmlWriter,XmlDocument,XmlNode,XmlLeaf,XmlContent}.java`
- `../decisions.md` — D2′, D3′, D4′, preamble sample
- Cached jar SVGs (`test-results/dot-cache/*/*/in.svg`) — ground truth for
  formatting/ordering questions

## Interface contracts (consumed by T5)
The element-creation methods drivers call, under upstream names
(`svgEllipse`, `svgRectangle`, `svgLine`, `svgPolygon`, `svgPath`, `text`,
plus translate handling), and document finalization returning the SVG
string.

## Acceptance criteria
1. Given a new document (w=79, h=301, DESCRIPTION), when finalized empty,
   then output matches the jar preamble sample attr-for-attr (incl. the PI
   and `<defs/><g>` skeleton).
2. Given an ellipse element request at fractional coords, then number
   formatting matches the jar's (verified against a cached in.svg value).
3. Given two gradient registrations with identical stops, then one def +
   stable ids per upstream's id scheme.
4. Given a UGroup(map) + UComment("entity X"), then `<g …>` attrs and
   `<!--entity X-->` match upstream emission.

## Observability / Rollback
N/A. / Reversible.

## Quality bar
Standard gates green; ≥90/90/90. The 500-line cap WILL bite — split per
D2′; `#lizard forgives` near function ends where lizard mis-spans; journal
each.

## Commit
`feat(T4): port SvgGraphics serializer + Xml writer stack`
