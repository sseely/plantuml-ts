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
