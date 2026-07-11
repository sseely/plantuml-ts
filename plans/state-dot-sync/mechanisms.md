# Svek-state mechanism catalog (T1)

Investigation only — no src changes. Java paths root at
`~/git/plantuml/src/main/java/net/sourceforge/plantuml/` (this checkout
already carries the plantuml-ts oracle seam:
`DotStringFactory.java:290-302` dumps `svek-N.dot` on
`-DPLANTUML_DUMP_DOT`, one file per `DotStringFactory.getSvg()` call —
that counter IS the pass-ordering mechanism used throughout this doc).
Units: Java emits inches at `px/72` (`SvekUtils.java:99-101`); sizes
below are given in pt (=px) with the inches value PlantUML prints.

## 1. Node shape/size table

| State kind | Java class | DOT shape | Size (pt / in) | Citation | Fixture |
|---|---|---|---|---|---|
| Simple state (has body or none) | `EntityImageState` | `rect,style=rounded` ("rounded") | `max(name⊕fields + 2·MARGIN(5) + 2·MARGIN_LINE(5), 50×50)` | `EntityImageState.java:66-67,104-113`; `IEntityImage.java:45-46` | bemena-23-zebu249 (1.967014×0.694444in); bajelo-54-dixe684 svek-1 (1.292535/1.304688×0.694444in, no-body min) |
| Simple state, `hide empty description` + empty body | `EntityImageStateEmptyDescription` | rounded | `max(name + 2·MARGIN, 50×40)` | `GeneralImageBuilder.java:135-136`; `EntityImageStateEmptyDescription.java:47-59` | bilare-19-fufe539: 4 states, all 0.555556in tall (40pt exact) |
| `<<sdlreceive>>` | `EntityImageState2` (USymbol FRAME) | `shape=rect` (NOT rounded) | no fixed formula — `asSmall.calculateDimension` off the FRAME symbol + body text | `GeneralImageBuilder.java:138-140`; `EntityImageState2.java:90-97` | cekolo-21-gini183: sdlreceive 1.598438×0.611111in |
| Circle-start (`[*]` source / `<<start>>`) | `EntityImageCircleStart`/`CircleStart` | `circle` | 20×20pt = **0.277778in** | `CircleStart.java:52,66-68` | cekolo-21-gini183 start1: 0.277778in |
| Circle-end (`[*]` target / `<<end>>`) | `EntityImageCircleEnd`/`CircleEnd` | `circle` | 22×22pt = **0.305556in** | `CircleEnd.java:55,69` | cekolo-21-gini183 end3: 0.305556in |
| History `<<history>>` / deep history `<<history*>>` | `EntityImagePseudoState` (text "H"/"H*") | `circle` | 22×22pt = 0.305556in (SAME for both — text differs, not size) | `EntityImagePseudoState.java:61,74-89`; `EntityImageDeepHistory.java:41-44` | cekolo-21-gini183 history/history2: both 0.305556in |
| Fork/join (`<<fork>>`/`<<join>>`/`SYNCHRO_BAR`) | `EntityImageSynchroBar` | `shape=rect` (NOT rounded) | 80×8pt TB (8×80 if LR) = 1.111111×0.111111in | `EntityImageSynchroBar.java:61,66-71,87-89` | cekolo-21-gini183 fork1/join2: 1.111111×0.111111in |
| Choice / junction (`<<choice>>`, `STATE_CHOICE`, `BRANCH`) | `EntityImageBranch` | `diamond` | 24×24pt = 0.333333in (SIZE=12, `*2`) | `GeneralImageBuilder.java:151-152`; `EntityImageBranch.java:56,68-69,97-99` | cekolo-21-gini183 choice1: 0.333333in |
| Entry/exit border point (`<<entrypoint>>`/`<<exitpoint>>`) | `EntityImageStateBorder` (leaf, `EntityPosition≠NORMAL`) | `RECTANGLE_PORT`: `shape=rect` basic (label width≤40) else `shape=plaintext` HTML table | 12×12pt = 0.166667in (`RADIUS(6)*2`) both axes; EXPANSION_* is 48×12 (or 12×48 LR) | `GeneralImageBuilder.java:130-134`; `EntityPosition.java:56,120-128`; `AbstractEntityImageBorder.java:85-88`; `SvekNode.java:138-220` | bitaxo-18-tamo974 `d <<entrypoint>>`: sh0010 0.166667×0.166667in |
| Composite state, non-empty, autarkic ("autonom") | `InnerStateAutonom` wrapping the child pass's `IEntityImage` | `rect,style=rounded` | name/attr text ⊕ child-pass total dims + `MARGIN`s | `InnerStateAutonom.java:130-197,199-201` | bemena-23-zebu249 svek-2 pre-sized rect 5.449097×3.555556in = its own svek-1 total |
| Composite state, empty body `{ }` (0 children/leafs) | `EntityImageState` directly (no child pass at all) | rounded | same MIN as simple state (50×50) | `GroupMakerState.java:113-114` | bajelo-54-dixe684 `Chg_Sector { }` — no extra svek-N.dot for it |
| Concurrent region (`STATE_CONCURRENT`, `--` separator) | `ConcurrentStates` of per-region `GraphvizImageBuilder` images, wrapped in `InnerStateAutonom` | rounded (outer); each region is its own inner layout | region images stacked with `ConcurrentSeparator` | `GroupMakerState.java:116-117,123-136` | not yet drilled — no `--`-region fixture inspected this pass; **OPEN** |

## 2. Cluster envelope grammar (`ClusterDotString.printInternal`, `Cluster.java`)

Non-autarkic composites stay `Entity` groups and render as a nested
`subgraph clusterN` INSIDE their container's own pass (no extra
svek-N.dot). Layer stack, outer→inner, each independently conditional
(`ClusterDotString.java:83-204`):

| Layer | id | Opens when | Purpose |
|---|---|---|---|
| a | `cluster{N}a` | `thereALinkFromOrToGroup1` — a link's endpoint IS the group entity itself (not a child), AND graphviz-version protection enabled | outer graphviz "protection" wrapper |
| p0 | `cluster{N}p0` | `protection0` = true unless swimlanes; forced false if the cluster has any entry/exit-position child | protection wrapper |
| **N** | `cluster{N}` | ALWAYS | the logical cluster — `style=solid;color=#…;` + (`labeljust`+`label=<TABLE…>` if titled, else `label="";`) |
| ee | `cluster{N}ee` | only if the cluster has entry/exit-position children (`entityPositionsExceptNormal.size()>0`); WithLabel if `!hasPort()`, NoLabel if `hasPort()` (PORTIN/PORTOUT only) | wraps rank-grouped port/border children; `{rank=source;…}`/`{rank=sink;…}` printed just before it |
| zaent | `za{groupUid}` node, `shape=point,width=.01,label=""` | printed right after the label/ee-open, whenever `thereALinkFromOrToGroup2` (edge touches the group itself) OR as the trailing content-placeholder when entityPositions>0 and no port/added node exists | synthetic edge-anchor for links whose endpoint is the GROUP, not a specific child (`Cluster.CENTER_ID="za"`, `getSpecialPointId`) |
| i | `cluster{N}i` | paired with `a` (`thereALinkFromOrToGroup1`) | inner protection wrapper |
| p1 | `cluster{N}p1` | `protection1` = true unless swimlanes (or `USymbols.NODE`); forced false with entry/exit children | protection wrapper |
| (content) | — | `cluster.printCluster1`+`printCluster2` | nested child clusters, then this cluster's own leaf/port nodes + edges |

`clusterN`'s id = `"cluster"+color` (`Cluster.java:649-651`, `color` = the
entity's slot in the shared color sequence — same counter space as node
`sh%04d` ids). Fixture: bemena-23-zebu249 svek-2 —
`cluster6a{cluster6p0{cluster6{…label…;zaent0001;cluster6i{cluster6p1{…}}}}}`
(no entry/exit children ⇒ no `ee`, plain `label=`). Counter-case:
bitaxo-18-tamo974 `state C{ state d <<entrypoint>> }` with **zero
transitions** — `a`/`p0`/`i`/`p1` ALL absent (no link touches C at all),
only `cluster6{ {rank=source;sh0010;} sh0010[...]; cluster6ee{label=<TITLE>;
zaent0003[shape=point...]; } }` — entry/exit forces the `ee` branch and
suppresses the protection layers independent of link-crossing.
**Correction to seed facts:** the seed-fact envelope example
(`cluster6a→p0→cluster6→i→p1`) is the *no-entry/exit-points* case only;
entry/exit-point composites take the shorter `clusterN{…ee{…}}` path with
no `a/p0/i/p1` at all — both are real, mutually exclusive shapes of the
same grammar.

## 3. Autonom decision rule

**Predicate** (`Entity.isAutarkic()`, `abel/Entity.java:690-715`): a
group `g` is autarkic (gets its own child svek pass, flattened to a
single `InnerStateAutonom` leaf) iff:
- `g.getGroupType() != PACKAGE` (packages are never autarkic), AND
- `INNER_ACTIVITY`/`CONCURRENT_ACTIVITY`/`CONCURRENT_STATE` are
  *always* autarkic (short-circuit true), else:
- every `Link` in the diagram is "pure inner" w.r.t. `g`
  (`EntityUtils.isPureInnerLink3`, `abel/EntityUtils.java:76-88`: both
  endpoints' containers are inside `g`'s subtree, or both are outside —
  false exactly when the link crosses `g`'s boundary), AND
- no leaf of `g` has `EntityPosition != NORMAL` (no entry/exit/pin
  border points anywhere inside `g`).

**Driver loop** (`dot/CucaDiagramSimplifierState.simplify`,
`dot/CucaDiagramSimplifierState.java:55-72`): repeatedly scans ALL
groups bottom-up (`getOrdered`/`addOneLevel`, deepest first); for every
`g.isAutarkic()`, calls `GroupMakerState(diagram,g,…).getImage()`
(`svek/GroupMakerState.java:110-138`) and **overrides `g` to a LEAF**
(`g.overrideImage(img, STATE|STATE_CONCURRENT)`) — loops until no group
changes (a composite can become autarkic only after its own non-autarkic
children have already been resolved one level down). A non-autarkic
group is never touched here; it stays a `GroupType.STATE` group and is
rendered as a nested `Cluster` by whichever pass — its own container's
autarkic pass, or the top-level diagram — reaches it.

**Dump order & attr omission, verified on bajelo-54-dixe684 (3 svek-N.dot
for a 3-level nest):** `Do_Sector{WriteSector,ReadSector}` is autarkic
(no link touches it) → svek-1, 2 nodes, no `nodesep`/`ranksep` line.
`Run{Chg_Sector,Do_Sector}` is NON-autarkic (`Stop-->Chg_Sector` crosses
Run's boundary) → stays a cluster; but `Track_FSM{Stop,Run}` IS autarkic
(neither `[*]-->Track_FSM` nor `Stop-->Chg_Sector` nor `Run-->Stop` nor
`Track_FSM-->[*]` crosses **Track_FSM's own** boundary) → svek-2 = 4
`shape=` decls incl. `subgraph cluster6` (=Run, containing Do_Sector's
AND Chg_Sector's now-flattened leaf rects), still no `nodesep`/`ranksep`
line. svek-3 = the outer diagram (circle-start, Track_FSM's flattened
leaf, circle-end), first line WITH `nodesep=0.486111`. **So: an
autarkic composite's own pass CAN itself contain nested `clusterN`
envelopes for its own non-autarkic children** — autonom and cluster
are not mutually exclusive across a nest, only within one group's own
resolution. Root cause of attr omission: `GraphvizImageBuilder.buildImage`
takes a caller-supplied `dotStrings[]` placeholder array
(`GraphvizImageBuilder.java:209`); `GroupMakerState` always calls it with
`new String[0]` (`GroupMakerState.java:117,125-126,132-133`) so
`createDotString`'s `"nodesep"/"ranksep"` substitution
(`DotStringFactory.java:116,140-149`) never fires; only the outer
diagram's own call passes `diagram.getDotStringSkek()`
(`atmp/CucaDiagram.java:397-412`, filters `getDotStrings()` down to
`nodesep`/`ranksep`/`layout` placeholders) — the LAST pass dumped is
always the one with graph attrs present.

## 4. Edge conventions

- **minlen** = `link.getLength() - 1` (`svek/SvekEdge.java:410,421,426`)
  — standard PlantUML arrow-length convention (extra `-` chars), not
  state-specific; same mechanism as class/object.
- **Labels**: guard/action/plain transition text renders as an HTML
  `<TABLE BGCOLOR=… FIXEDSIZE="TRUE" WIDTH=".." HEIGHT="15">` on the
  edge (`label=<...>`), same svek convention as class — see
  `class-dot-graph.ts`'s label emission for the existing TS pattern.
- **Crossing cluster boundaries**: PlainTUML's `compound=true`/`lhead`/
  `ltail` is commented out and unused (`DotStringFactory.java:156-159`)
  — edges into/out of a cluster's descendants are PLAIN node-to-node
  edges naming the real (possibly nested-then-flattened) leaf id
  directly; no lhead/ltail. Verified: bajelo svek-2
  `sh0012->sh0010[...]` = `Stop-->Chg_Sector`, Chg_Sector nested 1
  level inside cluster6(Run) — no compound attrs.
- **Edges touching the GROUP entity itself** (e.g. `Run-->Stop` where
  Run is a composite, not one of its children) redirect to the
  cluster's `zaent` point node instead of any child: bajelo svek-2
  `zaent0003->sh0012` = `Run-->Stop`.
  `zaent` = `Cluster.getSpecialPointId` = `"za"+group.getUid()`
  (§2) — same id/role used for the entry/exit content-placeholder,
  the two uses are structurally the same "give the group a synthetic
  anchor" mechanism; exact disambiguation of the two call sites is
  **OPEN** (not needed to implement — both cases emit the identical
  `za{uid}[shape=point,width=.01,label=""]` node).
- **`[*]` initial/final**: not a single shared node — `CIRCLE_START`
  (source, `[*]-->X`) and `CIRCLE_END` (target, `X-->[*]`) are distinct
  leaf types (`GeneralImageBuilder.java:145-149`), and (per our engine's
  existing `initialId`/`finalId` scoping in `layout.ts:144-145`) each
  nesting scope gets its own `[*]` node — consistent with the Java
  model (a `[*]` inside a composite is a different Entity than one at
  top level).
- **Entry/exit port edges**: EntityPosition.usePortP()
  (`abel/EntityPosition.java:186-188`) is true for ENTRY_POINT/EXIT_POINT
  and PORTIN/PORTOUT — these get a `:P` compass-point suffix on edges
  that reference them (mirrors what `graph-layout.types.ts`'s `isPort`
  field already models for the description engine — same mechanism,
  reuse the type, do not re-derive it for state).

## 5. Graph attrs

| Attr | Formula | Floor (STATE diagramType) | Citation |
|---|---|---|---|
| nodesep | `max(getHorizontalDzeta/10, floor)`, or literal `skinparam.getNodesep()` if nonzero | **35pt = 0.486111in** | `DotStringFactory.java:92-101,119-124,252-258` |
| ranksep | `max(getVerticalDzeta/10, floor)` (÷100 under `PragmaKey.KERMOR`), or literal skinparam override | **60pt = 0.833333in** | `DotStringFactory.java:103-114,128-133,242-250` |
| rankdir | `LR` iff `skinparam.getRankdir()==LEFT_TO_RIGHT` (from `left to right direction`); else omitted (TB is DOT's own default, never printed) | — | `DotStringFactory.java:171-174` |

Both floors match every drilled fixture's outermost pass exactly
(bemena/bajelo svek-N: `nodesep=0.486111;ranksep=0.833333`) — the
`getHorizontalDzeta`/`getVerticalDzeta` edge-driven term is presumed
rarely to exceed the floor for state diagrams (no fixture drilled this
pass had a wider value); **OPEN** if a T3/T4 fixture needs the exact
dzeta formula. `jocado-69-dara158` (`left to right direction`, 1 svek
dump) confirms `rankdir=LR;` on the single/outer pass — our
`layout.ts:203` hardcodes `rankDir:'TB'` unconditionally and the parser
doesn't capture the directive at all (§7).

## 6. Bucket → mechanism map

| Bucket (baseline count) | Mechanism(s) | Fixtures |
|---|---|---|
| graph-count mismatch (118) | §3 autonom/cluster split — our engine always recurses inline (one call per composite, always), never a separate child svek pass, never a plain-cluster path | bemena-23-zebu249 (2 oracle dumps vs 1 ours), bajelo-54-dixe684 (3 vs 1), beguxu-19-tize774 |
| shape (174) | §1 — `layout.ts`'s `dotNodes.push({id,...dims})` never sets `DotInputNode.shape`; every node defaults to plain `rect` in the emitter | beguxu-19-tize774, bilare-19-fufe539, cekolo-21-gini183 |
| nodesep (174) | §5 — `layout.ts:64` `NODE_SEP=36` (const, always emitted) vs oracle's 35pt-floor-or-computed value that's OMITTED entirely on child passes (§3) | beguxu-19-tize774, bilare-19-fufe539 |
| degree (77) | Downstream of graph-count/shape — once composites don't split into separate passes, node/edge sets per compared graph don't line up | beguxu-19-tize774, cekolo-21-gini183, datodo-22-beci222 |
| nodeCount (58: 16 over / 42 under) | Same root as graph-count — "over" from a composite oracle flattens away but we still emit as its own node-cluster mix; "under" from oracle's multi-pass producing more total nodes across passes than our single flattened pass | decede-10-buvu414 (under), see graph-count examples (over) |
| edge/minlen (48) | Edge topology shifts once nodes are misgrouped (§4); minlen itself (`getLength()-1`) is a shared, not state-specific, gap | datodo-22-beci222, defiga-15-puki727, dogeji-46-sapo750 |
| label (43) | Edge label HTML-table emission depends on correct edge topology first (§4); cascades from graph-count/shape | beguxu-19-tize774, datodo-22-beci222 |
| ranksep (43) | Same mechanism as nodesep (§5), smaller count because ranksep's floor (60pt) coincidentally lines up with `RANK_SEP=48`→ fewer numeric mismatches after rounding in some fixtures — still wrong in principle | beguxu-19-tize774, coteta-47-mare883, dapuko-98-zuzo096 |
| cluster (30, all under) | §2 — we never emit `DotInputCluster` envelopes for state composites at all (no cluster-vs-autonom split); oracle's non-autarkic composites are pure loss today | decede-10-buvu414, dogeji-46-sapo750, figevo-73-dani805, jejani-73-risu845 |
| rankdir (1) | §5 — `left to right direction` unparsed + `layout.ts:203` hardcodes TB | jocado-69-dara158 |
| no-candidate (12) | Parser gaps (§7) — `renderSync` completes but zero `layout()` calls fire | see §7 list |

## 7. Current-engine gap list (`src/diagrams/state/{parser,ast,layout,renderer}.ts`)

**Layout (`layout.ts`) — replace, not extend** (D1): the whole
recursive-`layoutLevel`/`COMPOSITE_PAD` model has no concept of
autarkic-vs-cluster, no `DotInputCluster` emission, no per-kind
`shape`, fixed `rankDir:'TB'` (:203), local `NODE_SEP`/`RANK_SEP`
consts instead of the 35/60pt floors (§5). `PSEUDOSTATE_SIZES` (:49-60)
values are wrong vs §1 (`choice`/`junction` 20×20 should be 24×24
diamond; `final` 24×24 should be 22×22 CircleEnd; no `fork`/`join`
rect-not-square shape flag). Every composite gets an inline recursive
`layout()` call unconditionally (:150-154) — must become: empty body →
leaf (no call); autarkic → separate `layoutGraph` pass + `InnerStateAutonom`-
style leaf; non-autarkic → `DotInputCluster` member of the CONTAINING
pass, no separate call.

**Types (`src/core/graph-layout.types.ts`) — additive extension needed**
(D3): `DotInputCluster` already carries `portRanks`/`portAnchorId`
(entry/exit `ee` branch, §2) — reusable as-is. Missing: the `a`/`p0`/
`i`/`p1` protection-layer wrapping and the crossing-link `zaent` anchor
for clusters WITHOUT port children (§2, §4) — `class-dot-graph.ts` and
`svek-dot-emit.ts`'s `clusterBlock`/`portClusterBlock` (:283-325) don't
implement these either (checked — not a state-only gap, but state is
the first diagram type whose corpus exercises the crossing-link case).

**Parser (`parser.ts`) — T2's concern; gaps observed via no-candidate
drilling** (not specced here): color modifiers `#red|yellow`,
`#red-green`, `##[dashed]`/`##[bold]`/`##[dotted]` line-style prefixes,
`#name;line:color;line.bold;text:color` compound color syntax (:336-
416 regexes only match bare `#\w+`); `<style>…</style>` blocks inside
state diagrams (taluke-81-noxa842); `[[url]]` state links; `$tag`
component tags + `remove $tag`; modified arrows `-->o`/`x-->`
(ball/cross endpoints); `entry / action` inline single-line shorthand;
`left to right direction` (no pattern at all, §5); capitalized `State`
keyword (kujuzo-76-bavi505 — unconfirmed whether case-sensitivity is
actually the cause, **OPEN**).

**No-candidate slugs (12) — `renderSync` succeeds, zero `layout()`
calls** (drilled via direct `ourInputs`-equivalent probe, no thrown
errors in any of the 12):

| Slug | Likely blocking syntax |
|---|---|
| bapoja-80-lori225 | `===B1===` spot/anchor state reference |
| dajipi-09-doki542 | `state X [[url]] { … }` composite with URL before `{` |
| fikuga-98-tagu554 | `#red-green ##00FFFF` gradient/line-color + empty composite bodies |
| jotini-12-fuba072 | `#pink;line:red;line.bold;text:red` compound color+line-style |
| kujuzo-76-bavi505 | capitalized `State` keyword and/or `note right #black-yellow` gradient note (unconfirmed which) |
| puvaco-19-geka094 | `##[dashed]` line-style suffix on `state … as X` |
| sesafu-14-nora165 | same as puvaco + `#line.dashed` |
| taluke-81-noxa842 | `<style>…</style>` block before the diagram body |
| votoki-67-gufa610 | `state X : entry / action,\n more action` inline entry/exit shorthand |
| xekebe-42-tuci754 | same as puvaco/sesafu (`##[dashed]`) |
| xexika-61-fedu273 | `-->o` / `x-->` decorated arrow endpoints |
| xoravu-40-gebe122 | `$tagA` component tags + `remove $tagA` |

## Seed-fact corrections

1. "Pseudostate circles: shape=circle 0.277778in" (README/T1 context)
   is only true for `CIRCLE_START`/`<<start>>` (20pt). `CIRCLE_END`/
   `<<end>>`/history/history* are 22pt = 0.305556in — two distinct
   sizes, not one.
2. The `cluster{N}a→p0→{N}→i→p1` envelope is NOT the only shape: composites
   with entry/exit-position children take `cluster{N}→{N}ee` with NO
   `a/p0/i/p1` at all (§2) — both are real, condition-selected shapes of
   the same `ClusterDotString` grammar, not one canonical form.
3. "Autonom" is not literally "no crossing links" in isolation — it is
   evaluated per-group against the WHOLE diagram's link set, so a
   deeply-nested autarkic group can exist inside (and itself directly
   contain, via its own child pass) a non-autarkic cluster ancestor's
   sibling, and an autarkic group's own pass can itself contain nested
   `clusterN` envelopes for its own non-autarkic children (§3,
   bajelo-54-dixe684 svek-2). The mission brief's D2 ordering claim is
   correct; this refines "which composite goes which path" beyond a
   single boundary check.
