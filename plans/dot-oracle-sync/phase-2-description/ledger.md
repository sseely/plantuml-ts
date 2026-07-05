# Description divergence ledger

Every non-EQUAL fixture at phase exit has an entry here (loop-protocol.md
step 8). Empty at phase start.

## kermor pragma changes ranksep floor
- Mechanism: `!pragma kermor on` lowers upstream's ranksep floor 60→40
  (Java: `DotStringFactory.getMinRankSep()`; ours: no pragma support at all)
- Disposition: blocked-on pragma subsystem (unimplemented; broader than svek)
- Slugs: fojamu-08-veku866 (+2 component ranksepOk residuals from i1 report)

## dispatcher misroute: alias syntax not in description grammar
- Mechanism: `Admin as :Main Admin:` isn't parsed by description, so
  `accepts()` rejects and the block falls through to the json engine
  (ours: `src/diagrams/json/layout.ts:551-557` supplied the LR/20/40 attrs)
- Disposition: needs-iteration (real grammar gap — fold into the
  auto-create/endpoint-grammar iteration, category 3)
- Slugs: zilisi-99-rate911

## rich-text label measurement (markup + hyperlinks)
- Mechanism: labels with `<b><size:13>`, `<color:green>`, `\n`, `[[url]]`
  are measured as raw literals; upstream measures the rendered text, so
  dzeta-derived nodesep differs (formula itself verified correct)
- Disposition: blocked-on creole-aware label measurement (text-metrics
  sub-problem, D1 tolerance territory)
- Slugs: jecici-56-bimu826, malumi-33-safu797

## edge-to-member gets redirected to the cluster anchor (together blocks)
- Mechanism: not yet found. `ACRaiz -down-> SRF` (SRF is a real leaf member
  of cluster `SRFRet`, not the cluster's own name) is nonetheless routed by
  the oracle to `SRFRet`'s `zaNNNN` anchor point, not to `SRF`'s own node.
  Confirmed distinct from the implemented group-anchor mechanism (P2/i5),
  which only fires when a link literally names the group id itself
  (verified correct via balipa-82-feto843: `AA -r-> BB` where AA IS the
  group). Co-occurs with `together{}` sub-grouping (also unimplemented —
  see below) and `left to right direction`; root mechanism not isolated.
- Disposition: needs-iteration — new drill-down session, likely in
  `Link`/entity resolution or together-block rank wiring, not
  `ClusterDotString`/`Bibliotekon` (already read in full for P2/i5).
- Slugs: berufi-69-dara369 (usecase)

## `together { }` blocks are not modelled as clusters
- Mechanism: upstream nests `together{}` members as `cluster<N>t<i>`
  sub-subgraphs (Cluster.java printTogether); our engine has no equivalent
  — `together` members become plain flat leaves of the enclosing group
  (or top-level), so clusterOk under-counts whenever a fixture uses
  `together{}` inside a package/rectangle.
- Disposition: needs-iteration — a distinct, not-yet-scoped feature
  (`together` layout hint parsing + cluster sub-nesting).
- Slugs: berufi-69-dara369 (usecase); likely more (not yet swept).

## `style=invis` ordering edges we never emit
- Mechanism: oracle emits `sh0010->sh0011[...,style=invis]`-style hidden
  edges not present in our DotInputGraph at all (2 in balomu-94-kegi822).
  Likely `together`-block or explicit-ordering artifacts; not yet traced
  to a specific upstream call site.
- Disposition: needs-iteration — separate diagnosis from cluster emission.
- Slugs: balomu-94-kegi822 (component)

## port / EntityPosition placeholder mechanism
- Mechanism: `ClusterDotString`'s `hasPort()`/`entityPositionsExceptNormal`
  branch emits a `shape=plaintext` PORT-cell node plus a `clusterNee`
  sub-subgraph with a `shape=rect,width=.01,height=.01,label=<TABLE...>`
  placeholder reusing the group-anchor id. Requires a `port` USymbol/
  qualifier concept our AST doesn't have.
- Disposition: needs-iteration — distinct feature, own mission.
- Slugs: banatu-09-koce254 (component)

## bare/quoted auto-created link endpoints default to `rectangle` (P2/i6)
- Mechanism: `CommandLinkElement.getDummy` creates undecorated link
  endpoints as `LeafType.STILL_UNKNOWN` (no USymbol); `DescriptionDiagram
  .makeDiagramReady` (`descdiagram/DescriptionDiagram.java:79-87`) mutes
  every still-unknown leaf to `defaultSymbol = isUsecase() ?
  actorStyle().toUSymbol() : USymbols.INTERFACE` — a component/deployment
  diagram (no actor/usecase present) defaults bare endpoints to INTERFACE
  (shielded plaintext, see shape-mechanism.md §2); a usecase diagram
  defaults them to actor (plain rect). Ours: `link-grammar.ts
  #classifyEndpointShape` hardcodes `USymbol: 'rectangle'` for bare/quoted
  endpoints instead — requires touching `link-grammar.ts`/`parser.ts` (and
  possibly a still-unknown marker on `ast.ts`) to add the diagram-wide
  `isUsecase()` post-pass, outside this iteration's write-set
  (`layout.ts`/`layout-helpers.ts`/`graph-layout.types.ts`/
  `svek-dot-emit.ts`).
- Disposition: needs-iteration — parser-level auto-create symbol
  resolution, own iteration.
- Slugs: balopu-66-jagu236 (component; 5 of 6 bare targets should be
  shielded interfaces)

## `cimare-47-deke334` node/edge count divergence (no links in source)
- Mechanism: not diagnosed this iteration — the fixture declares seven
  usecase entities with **no explicit links** (`left to right direction` +
  several `(text) as alias` / `usecase "text" as alias` declarations, some
  repeating the same display text under a different alias), yet the oracle
  DOT has 7 nodes and 6 edges with real degree ≥1 on every node. Shapes
  are already correct (all `ellipse`) after this iteration's fix — the
  divergence is nodeCount/edgeCount/degree/minlen, not shape. Candidate
  mechanism (unconfirmed): upstream may merge/link entities that share
  display text via some quark/alias resolution path not modelled in our
  parser. Not a shapeOk-only fixture; out of scope for the shape mission.
- Disposition: needs-iteration — new drill-down, likely categories 3/4
  (auto-create/endpoint-grammar) territory, not shapes.
- Slugs: cimare-47-deke334 (usecase)
