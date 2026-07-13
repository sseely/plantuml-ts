# G0b Architecture Decisions (locked)

Generated under autonomous execution 2026-07-13 (maintainer away; resume.md
directive + mission-index grind protocol authorize brief generation). Each
decision was auto-approved by the orchestrator and is revisitable by the
maintainer; contradicting one during execution is a STOP condition.

Upstream reference: this checkout of `~/git/plantuml` has refactored
`AnnotatedBuilder`/`AnnotatedWorker` into **`DiagramChromeFactory`**
(`net/sourceforge/plantuml/core/DiagramChromeFactory.java`, Javadoc lines
82-86 says so explicitly). There is no `DisplaySection`; the model is
`DisplayPositioned` only.

## D1 — One shared chrome module, ported faithfully

`src/core/annotations/` ports the upstream mechanism: model
(`DisplayPositioned`, the `Annotated` 6-getter surface), commands (the 11
`Command*` regexes + `CommandMainframe` parse), style resolution
(`plantuml.skin` document-block defaults), and geometry
(`DecorateEntityImage` math + `DiagramChromeFactory` wrap order:
warnings→frame→legend→title→caption→header/footer, i.e. header/footer
outermost). **No per-engine chrome drawing.** Preserve upstream names.

## D2 — Plugins return a fragment; assembly is central

`plugin.render` changes from "complete `<svg>` string" to a
`RenderFragment { body, width, height, background?, extraDefs? }`; the
pipeline (src/index.ts) applies chrome then calls `svgRoot` once, centrally.
This re-mirrors upstream's `getTextBlock → addChrome → exporter` order — our
"every plugin emits its own `<svg>`" was the structural divergence that made
title rendering impossible to share. The description engine (klimt) keeps
emitting through klimt but routes through the SAME chrome geometry/blocks
(see D2b in batch-3/T7); its plugin may keep returning a complete svg if
klimt fragment-extraction proves invasive — the chrome must still come from
`src/core/annotations/`, applied inside its klimt pipeline as TextBlock
decoration (that path is upstream's own shape).

## D3 — Extraction inside each parser, never a textual pre-pass

Each parser calls the shared annotation matcher at its own command-dispatch
position (where the ignore-patterns / silent drops sit today). A pre-parse
strip would steal `title …` lines from inside multiline constructs (`note …
end note`) — the same class of bug SI5a killed in `resolveIncludes`. The AST
gains an optional shared field `annotations?: DiagramAnnotations`; index.ts
reads it between `parse` and the chrome step.

## D4 — Chrome text measured via the injected StringMeasurer

Title/caption/header/footer/legend blocks measure through the
`StringMeasurer` seam (deterministic in conformance, jar/canvas in
production). Creole's internal `CHAR_WIDTH_RATIO = 0.6` heuristic is
forbidden for chrome dimensions.

## D5 — Byte-stability for annotation-free input

With no annotation directives present, every engine's output must be
byte-identical to today (batch-1's fragment refactor proves this by the
existing 7,643 tests passing without golden churn). Deliberate output changes
are confined to: (a) diagrams that carry annotations, (b) json/dot/chart
titled diagrams when their bespoke bands migrate (T8, jar-verified).

## D6 — Style defaults from plantuml.skin; skinparam + <style> overrides

Base values are the `document{}` block of upstream
`src/main/resources/skin/plantuml.skin` (verbatim in T2's spec). Overrides:
skinparam keys per upstream `FontParam`/`SkinParam` naming
(TitleFontSize/TitleFontColor/LegendBackgroundColor/…, verified against the
Java in T2), and `<style>` selectors `title|caption|header|footer|legend`
via the existing `parseStyleBlock`/`applyStyleMap` plumbing.

## D7 — Legend semantics: top/bottom bands only

`legend [top|bottom] [left|right|center]` (VALIGN before ALIGN, both
optional); single-line `legend: text` = CENTER/BOTTOM with no options.
Upstream's `VerticalAlignment` has center commented out — there is no
side-placed legend. Legend style signature is diagram-type-specific
(`root,document,<type>,legend`); title/caption/header/footer are not.

## D8 — Alignment: title/caption forced CENTER; header/footer honor stored alignment

`DiagramChromeFactory.addTitle/addCaption` hard-code CENTER at draw time
(the stored alignment is not re-read). Header default RIGHT, footer default
CENTER, from the style when no explicit `left|right|center` prefix. Match
this exactly, including the quirk.

## D9 — Mainframe: parsed always, rendered in T9; ledger if it slips

`CommandMainframe` parses into the model in T1. The `BigFrame` rendering
port is T9 (small, isolated). If T9 hits a stop condition, mainframe
rendering is recorded in `DIVERGENCES.md` as TEMPORARY — never silently
dropped.

## D10 — json/dot/chart bespoke titles migrate to shared chrome

Upstream `JsonDiagram`/directdot/chart types are `TitledDiagram`s — their
titles go through the same chrome. Our bespoke bands (dot `TITLE_HEIGHT=30`,
json `fontSize*1.8+8`, chart) are the divergence; T8 removes them. Chart's
`legend <pos>` data-series keyword is NOT the legend directive and is
untouched.

## Operational readiness (library context)

- **Observability:** N/A — pure function library; no services, no SLIs. The
  "dashboards" are the DOT gate and the SVG census; both run per batch.
- **Rollback:** Reversible — git revert of the merge commit. No data, no
  migrations. Public API (`render`/`renderSync`/`renderAll` signatures)
  unchanged; the plugin interface is internal (not exported from the package
  entry point).
- **Scalability:** N/A — chrome adds O(annotation-blocks) work per render.
- **On-call:** N/A. Failure modes surface as test/gate failures pre-merge.
- **Backwards compatibility:** output SVG for annotation-free diagrams is
  byte-stable (D5); titled output changes are the point of the mission and
  are jar-verified.
