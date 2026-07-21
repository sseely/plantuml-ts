# `HTML_STRING_MARK` not exported — no public way to set an HTML label
# via the programmatic builder

**Impact:** blocks the render half of G4's "mechanism 16" (entity-vs-
cluster wrap) — 92 state fixtures + the 20-fixture `<<entrypoint>>`/
`<<exitpoint>>` family gated behind it. `graph-layout-build.ts#addClusters`
(the seam `layoutGraph()` actually uses in production) builds its graph
programmatically (`createGraph`/`addSubgraph`/`setAttr`), never through
graphviz-ts's DOT-text parser. The jar drives every cluster's real title
reservation via an HTML `<TABLE FIXEDSIZE="TRUE" WIDTH=".." HEIGHT="..">`
label (`ClusterHeader.java`, `ClusterDotString.java:121-133`,
`SvekEdge.appendTable`) — issue 05 already confirmed graphviz-ts's LAYOUT
ENGINE honors this correctly once given one, but only demonstrated it via
DOT-TEXT input (where `label=<...>` syntax is parsed natively). The
programmatic `GvGraphBuilder.addSubgraph(name, attrs)` takes a plain
`Record<string, string>` — `setAttr`'s value is treated as a literal DOT
string unless it starts with the internal HTML marker
(`common/html-string.d.ts`'s `HTML_STRING_MARK`, a single U+0001
control-character prefix mirroring cgraph's `aghtmlstr`), and that
constant is not part of the package's public surface (absent from
`api/index.d.ts`/`index.d.ts`).

## Repro

```ts
import { createGraph, render, getLayout, setTextMeasurer, LutTextMeasurer } from 'graphviz-ts';
setTextMeasurer(new LutTextMeasurer());
const b = createGraph({ directed: true });
b.addNode('F', { shape: 'box', fixedsize: 'true', label: '', width: '0.694', height: '0.694' });
// No public API accepts an HTML label here -- `attrs.label` is always
// treated as a plain string by the programmatic builder.
const cluster = b.addSubgraph('cluster0', {
  label: '<TABLE FIXEDSIZE="TRUE" WIDTH="10" HEIGHT="3"><TR><TD></TD></TR></TABLE>',
});
cluster.addNode('F');
render(b.graph, 'svg', { engine: 'dot' });
// getLayout(b.graph).clusters[0] reserves space for the LITERAL STRING
// "<TABLE ...>...</TABLE>" measured as plain text (wrong, and warns:
// "no hard-coded metrics for 'Times,serif'"), not a 3pt-tall HTML table.
```

Manually prefixing the label value with `String.fromCharCode(1)` (the
documented-but-unexported marker) DOES work end-to-end through this exact
programmatic path — verified: `getLayout()`'s cluster geometry then
reserves EXACTLY the FIXEDSIZE `HEIGHT` given, confirmed linear
(`node_top − cluster_top = HEIGHT + 16`, 15 data points, `HEIGHT` from 1pt
to 50pt, both with and without an outbound edge from the wrapped node).
This is undocumented, non-exported behavior, not a sanctioned public API
contract — plantuml-ts should not depend on it without either (a) a
maintainer confirmation that the marker's ABI is stable, or (b) a proper
builder-level API.

## Ask

Export `HTML_STRING_MARK` (or `isHtmlValue`/`htmlValueContent`) from the
package's public surface, OR add a dedicated builder convenience — e.g.
`addSubgraph(name, { htmlLabel: '<TABLE>...</TABLE>' })` / a
`setHtmlAttr(k, html)` method on `GvGraphBuilder` — so a programmatic
caller has a supported way to request HTML-table label sizing without
reaching into an internal, unexported control character.

## Evidence trail

`plans/g5-measurer-calibration/ledger.md` §C2 (mechanism 16 investigation:
19/19 real state-diagram cluster fixtures confirm jar's real single-line
composite-title header reservation is a CONSTANT 19px at font-size 14,
matching `HEIGHT=3` through this exact marker-prefixed path — `19 = 3 +
16`); `docs/graphviz-issues/05-cluster-label-dimensions-ignored.md`
(engine-level capability, confirmed resolved, but only exercised via
DOT-text parsing, not the programmatic builder this port actually calls).
