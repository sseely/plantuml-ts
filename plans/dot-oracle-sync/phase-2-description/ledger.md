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

## note-on-link (`CommandFactoryNoteOnLink`) — parsed and dropped (P2/i11)
- Mechanism: upstream attaches a `CucaNote` to `Link.addNote` for `note
  [pos] on|of link [#color][: text]` (single-line and `end note` block);
  its svek DOT shape/positioning was not diagnosed this iteration — no
  fixture in the component/usecase corpus (tests/corpus) exercises this
  form, so there is no oracle DOT to verify a node/edge shape against.
  `note-grammar.ts#matchOnLink` recognizes both forms (single-line and
  multi-line open, registered ahead of note-on-entity exactly as
  `DescriptionDiagramFactory` orders `CommandFactoryNoteOnLink` before
  `CommandFactoryNoteOnEntity`) and drops them rather than guessing at a
  node/edge shape.
- Disposition: needs-iteration — needs its own oracle fixture (upstream
  nonreg or a hand-authored one) before a shape can be verified.
- Slugs: none in the current corpus.

## `$tag` component declarations + tag-based `remove` (Stereotag/HideOrShow)
- Mechanism: `component a $a { }` attaches a `Stereotag` ("$a") to the
  declaration (`net.sourceforge.plantuml.stereo.Stereotag`); `remove $a`
  resolves through `CucaDiagram.removeOrRestore` → `HideOrShow` pattern
  matching (tag/stereotype match, not exact-id lookup) — the same
  out-of-scope mechanism already flagged in `parser.ts#removeEntity`'s
  docstring (`<<stereotype>>`/`@unlinked` forms). Confirmed NOT a
  notes-mechanism regression: identical 2-node output both before and
  after this iteration's note port (verified via `git stash`) — our
  `remove $a` is simply a no-op today (id `"$a"` never matches the stored
  id `"a"`), so the note this fixture also has (`note right of a: test_a`)
  never enters the divergence at all; the note itself parses and attaches
  correctly.
- Disposition: needs-iteration — Stereotag + HideOrShow pattern matching,
  a distinct pre-existing gap; own mission per D3/cluster-mechanism.md.
- Slugs: kokebo-27-vafi688 (component)

## `label X [ ... ]` multi-line bracket body unimplemented (CommandCreateElementMultilines)
- Mechanism: upstream's `label X [` ... `]` (and similar element forms)
  is a raw multi-line TEXT capture for the element's display — not
  further parsed as diagram commands. Our parser has no equivalent
  (`CONTAINER_INLINE_RE`/`CONTAINER_OPEN_RE` only handle `{ }` bodies),
  so the bracket lines fall through line-by-line: keyword lines inside
  the bracket (e.g. `cloud cloud`) spuriously create real entities, and
  a `note right: ...` line inside gets attached to whatever "last
  entity" that spurious parse produced. Pre-existing gap, unrelated to
  the note port (verified: the note command itself resolves correctly
  against whatever "last entity" state the parser is in; the wrong
  state is entirely CommandCreateElementMultilines' absence).
- Disposition: needs-iteration — own mission (multi-line bracket bodies
  are a distinct CommandFactory, not part of note commands).
- Slugs: lonatu-36-tife499, tefeco-12-rato895 (both component)

## `remove`/`remove $tag` is splice-based; upstream's is a lazy marker
- Mechanism: `CucaDiagram.removeOrRestore` (net/atmp/CucaDiagram.java:611-614)
  only ever APPENDS a `HideOrShow(what, show)` marker to `this.removed` — it
  never deletes the underlying quark/entity. `CucaDiagram.leafs()` (:836-845)
  enumerates every quark with data regardless of that marker, and
  `DotData.isDegeneratedWithFewEntities` (dot/DotData.java:69-71) counts
  `getLeafs().size()` — i.e. the PRE-removal leaf count. Our port implements
  `remove <id>`/`remove $tag` (element-grammar.ts#removeMatching) as an
  actual AST splice (P2/i5's design, extended this iteration to tags),
  because there is no lazy "isRemoved" predicate threaded through layout.
  For a fixture that removes entities down to exactly one surviving leaf
  with zero links/groups, upstream's degenerate shortcut
  (GraphvizImageBuilder.buildImage:211-222, ported as
  `layout-helpers.ts#degenerateSingleLeaf`) does NOT engage (real leaf
  count is still ≥2, since removed entities still count), so a normal
  1-node graphviz-invoking graph is still emitted (oracle: 1 captured
  graph); our splice-based count is genuinely 1, so `degenerateSingleLeaf`
  engages and we emit 0 graphs.
- Disposition: needs-iteration — fixing this faithfully means converting
  `remove`/`remove $tag` from a structural splice to a lazy marker
  (equivalent to `isRemoved`) checked at layout/emission time, a
  materially larger change than this iteration's declaration-grammar
  scope; not attempted here. `remove $tag` is otherwise correct (see
  kokebo-27-vafi688, EQUAL) — this is specifically the degenerate-shortcut
  interaction, only visible when removal reduces the leaf count to 1.
- Slugs: cenoja-47-rodu998 (component; not previously reachable to EQUAL
  at all before this iteration's `remove $tag` port, so not a regression).
