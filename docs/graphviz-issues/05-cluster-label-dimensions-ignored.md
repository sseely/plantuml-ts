# `addSubgraph` has no cluster-label width/height parameters

**Impact:** the PlantUML jar drives cluster width from the title text
via the HTML `<TABLE FIXEDSIZE WIDTH=".." HEIGHT="..">` label (see
the labels in issues 02 and 04 — PlantUML always emits these).
graphviz-ts's `addSubgraph` accepts only a string `label`; the numeric
dims are parsed nowhere, so a title-driven cluster width floor (e.g.
`skinparam package{FontSize 40}` forcing a 325px-wide package) cannot
be expressed (verified against `dist/api/builder.d.ts`).

## Repro

Take issue 02's repro DOT and raise the TABLE WIDTH to 300 — real dot
widens the cluster to fit; graphviz-ts's cluster size is unchanged.

## Ask

Parse HTML-table cluster labels (at least FIXEDSIZE/WIDTH/HEIGHT) or
add explicit label-dimension parameters to `addSubgraph`.

## Evidence trail

`plans/g2-class-svg/ledger.md` (cluster-sizing sections feeding N61).
