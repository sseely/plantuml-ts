# Cluster DOT emission mechanism (P2/i5)

Diagnosis for mission dot-oracle-sync, phase 2 iteration 5. Read in full:
`svek/ClusterDotString.java` (~200 lines), `svek/Cluster.java:560-660`,
`svek/DotStringFactory.java:200-240`, `svek/Bibliotekon.java:120-138`,
`svek/SvekEdge.java:240-273`, `svek/GraphvizImageBuilder.java:399-436`.

## (a) Which point/anchor nodes are emitted, and when

Three distinct point-node mechanisms exist in upstream svek. Only the first
applies to description diagrams (component/usecase/deployment); the other
two are cited for completeness and to rule them out.

### 1. Group-anchor point (`za<uid>`) — IN SCOPE

`Bibliotekon.getNodeUid(Entity ent)` (Bibliotekon.java:120-138): every DOT
node id an edge references comes from here. If `ent` has a `SvekNode` (a
real leaf), its uid is used. **Else, if `ent.isGroup()`, the id is
`Cluster.getSpecialPointId(ent)` = `"za" + ent.getUid()`** — a synthetic
point, one per group, shared by every edge that touches that group.

`ClusterDotString.printInternal` (lines 91, 148-149) computes
`thereALinkFromOrToGroup2 = isThereALinkFromOrToGroup(lines)` —true iff any
`SvekEdge.isLinkFromOrTo(this.group)` (`link.getEntity1() == group ||
link.getEntity2() == group`, SvekEdge.java:1270-1272) — and, if true, emits
exactly one line inside that cluster's own subgraph body (not nested in any
child sub-cluster):

```java
sb.append(Cluster.getSpecialPointId(cluster.getGroup())
    + " [shape=point,width=.01,label=\"\"];");
```

So: **one edge from/to a GROUP (not one of its leaves) ⇒ one `shape=point`
node declared as a direct member of that group's own cluster subgraph**,
regardless of how many edges reference that same group (shared, not
per-edge). `SvekEdge`'s constructor (SvekEdge.java:252-258) additionally
sets `ltail`/`lhead` to the referenced `Cluster` whenever the start/end uid
starts with `Cluster.CENTER_ID` ("za") — used only for `dotPath
.simulateCompound(lhead/ltailRectangleArea)` (SvekEdge.java:671-672), i.e.
upstream *also* visually clips the rendered spline to the cluster's
rectangle in Java code. No `lhead=`/`ltail=` DOT attribute is ever written
(grepped: absent from `SvekEdge.appendLine`) — compound-edge clipping is
done in Java, not delegated to graphviz's `compound=true`.

### 2. Port placeholder (`hasPort()` / EntityPosition) — OUT OF SCOPE

When a cluster's own leaves carry non-NORMAL `EntityPosition` (state/activity
port-diagram entities), `ClusterDotString` opens a nested `clusterNee`
subgraph and, if the cluster has zero plain leaves, emits either a
`shape=rect,width=.01,height=.01,label=<TABLE...>` (has-port) or
`shape=point` (no-port) placeholder reusing the *same* `za<uid>` id (the
`empty()` helper, ClusterDotString.java:220-226, deliberately reuses the
group-anchor id — "we cannot put a new node in the nested inside of the
cluster if thereALinkFromOrToGroup2 is enabled"). `entityPositionsExceptNormal
.size() > 0` is required to reach this branch. Confirmed via drill-down
`banatu-09-koce254` (component): `shape=plaintext` PORT-cell node +
`cluster6ee`/`zaent0001 [shape=rect,width=.01,height=.01,label=<TABLE...]`.
Description diagrams' leaves are always `EntityPosition.NORMAL` (ports are a
distinct, currently-unimplemented USymbol feature) — **not implemented in
this iteration**; logged in the ledger below.

### 3. Min/max rank points (swimlanes) — OUT OF SCOPE, does not apply

`DotStringFactory.manageMinMaxCluster` (lines 207-240) emits `{rank=min;...}`
/ `{rank=max;...}` point nodes from `cluster.getMinPoint(type)` /
`getMaxPoint(type)`, both of which return `null` unless
`skinParam.useSwimlanes(type)` is true (Cluster.java:657-663). Swimlanes are
an activity/state-diagram-only feature — never true for `DiagramType
.DESCRIPTION`. Confirmed no `{rank=min` / `{rank=max` in any of the 353
component+usecase oracle dumps sampled. Not applicable to this engine.

## (b) How an edge to a GROUP endpoint is wired

The DOT edge line (`SvekEdge.appendLine`, line 398-400) just prints
`startUid.getFullString() -> endUid.getFullString()`, where `startUid`/
`endUid` come from `link.getEntityPort1/2(bibliotekon)`, which bottoms out
in `Bibliotekon.getNodeUid` above. There is **no `lhead=`/`ltail=`
attribute** in the DOT text — compound-edge clipping to the cluster
rectangle happens in Java (`dotPath.simulateCompound`), not via graphviz's
`compound=true`. Confirmed by drill-down `balipa-82-feto843`: oracle edge
`zaent0004->sh0013` — the FROM side is the point node inside `cluster7`
(`subgraph cluster7 {...zaent0004 [shape=point,width=.01,label=""];...}`),
proving a group-to-leaf edge is wired directly to the point, with no
separate compound-edge attribute.

## (c) Empty-group leaf-vs-cluster condition

`GraphvizImageBuilder.printGroups` (lines 408-423):

```java
if (dotData.isEmpty(g) && g.getGroupType() == GroupType.PACKAGE) {
    g.muteToType(LeafType.EMPTY_PACKAGE);
    printEntity(stringBounder, g);       // → plain leaf node, no cluster
} else {
    printGroup(stringBounder, g);         // → cluster (subgraph), even if empty
}
```

`Entity.isEmpty()` (abel/Entity.java:677-684): true iff the entity's quark
has **zero non-removed children of any kind** (leaf or sub-group) — a group
containing only a further-empty sub-group is NOT itself empty.

`GroupType` (abel/GroupType.java): `ROOT, PACKAGE, STATE,
CONCURRENT_STATE, INNER_ACTIVITY, CONCURRENT_ACTIVITY, DOMAIN, REQUIREMENT`.
Every description-diagram block-group command (`package`, `rectangle`,
`node`, `folder`, `cloud`, `database`, `component { }`, archimate packages —
all routed through `CommandPackageWithUSymbol`/`CommandArchimatePackage`,
grepped: both hard-code `GroupType.PACKAGE`) creates a `GroupType.PACKAGE`
group. `STATE`/`CONCURRENT_STATE`/`*_ACTIVITY` groups only ever arise from
state/activity diagrams (a different engine/renderer, out of scope here).

**Verified condition for description diagrams: an empty group is ALWAYS
GroupType.PACKAGE, so it is ALWAYS demoted to a plain leaf — the
"stays-a-cluster-while-empty" branch is structurally unreachable for
component/usecase/deployment.** Verified against:
- `babafi-51-dixi026` (`component "b" as b { }`) → oracle emits a plain
  `shape=rect` leaf, no `subgraph cluster` — matches the demotion branch.
- Searched all 353 sampled component+usecase oracle dumps for a cluster
  subgraph whose only member is a lone `zaent*` point (which would be the
  signature of an empty-but-still-clustered group): none found. The three
  point-bearing dumps found (`balipa-82-feto843`, `balomu-94-kegi822`(no —
  see below), `berufi-69-dara369`) all pair the point with ≥1 real leaf,
  because the group-anchor mechanism ((a).1) requires `isThereALinkFromOrToGroup`
  which is orthogonal to emptiness — the group itself is never empty in
  these cases (it has real children; the group-anchor node is *added to* a
  non-empty cluster, not a replacement for an empty one).

**Conclusion: plantuml-ts's existing behaviour (an empty container symbol —
zero children — is added to `leafIdSet` and emitted as a plain
`DotInputNode`, never a `DotInputCluster`) is already upstream-faithful.
No change needed for empty groups.** The only real gap is (a).1 above: a
**non-empty** cluster referenced directly by an edge needs its group-anchor
point node.

## Drill-down verdicts

| Fixture | Type | Verdict |
|---|---|---|
| `balipa-82-feto843` | component | Confirms (a).1 exactly: `zaent0004->sh0013`, `zaent0004 [shape=point,...]` inside `cluster7`, cluster7 memberCount=2 (1 leaf + 1 point). Also exposed an orthogonal bug: our emitter names clusters `c0`/`c1`/… but the comparator's `parseClusters` requires literal `/^cluster\d+$/` — **every** cluster we emit was invisible to `clusterOk` before this fix, regardless of the point-anchor mechanism. |
| `balomu-94-kegi822` | component | clusterOk failure is the same `cN`-vs-`clusterN` naming bug (memberCount 3 matches once renamed). Also has 2 oracle `style=invis` edges we don't emit at all — **unrelated** to cluster emission (likely `together`/ordering hidden edges); logged to ledger, out of scope. |
| `banatu-09-koce254` | component | NOT the group-anchor mechanism — this is (a).2, the port/`EntityPosition` placeholder (`shape=plaintext` PORT cell + `cluster6ee`/`zaent0001 [shape=rect,width=.01,height=.01,...]`). Out of scope for this iteration; logged. |
| `berufi-69-dara369` | usecase | **Revised after implementation testing** — initially read as confirming (a).1 "at scale", but the source (`ACRaiz -down-> SRF`) targets `SRF`, a *leaf member* of the `SRFRet` cluster, not the cluster's own name (`SRFRet`/`ACRet`/`PRRet` never appear on either side of any link). Oracle nonetheless routes the DOT edge to `zaentNNNN` (the cluster's anchor), not to `SRF`'s own node. This is a **different, not-yet-diagnosed mechanism** — some upstream step redirects an inbound cross-cluster edge onto the cluster's anchor even when the user named a specific member, in a diagram that also uses `together{}` sub-grouping (unimplemented in our engine — see `balomu-94-kegi822` note) and `left to right direction`. (a).1 (implemented) only fires when the link literally names the group — verified correct via `balipa-82-feto843` (`AA -r-> BB` where `AA` is itself the group). Ruled out: not the `entityPositionsExceptNormal`/port path ((a).2 — no ports here); not (a).1 as coded (SRF is a real leaf, not the group). Not fixed this iteration — logged to the ledger as a distinct mechanism needing its own drill-down (likely inside `Link`/entity resolution or `together`-block rank wiring, not `ClusterDotString`/`Bibliotekon`). |

## Implementation (additive)

- `DotInputNodeShape` already had `'point'`; `svek-dot-emit.ts`'s `nodeLine`
  already special-cased it (`shape=point,width=.01,label=""`, no width/height
  echoed) — no emitter changes needed.
- `src/diagrams/description/layout.ts` / `layout-helpers.ts`:
  - `resolveEndpoint` no longer walks to `firstDescendantLeaf` for a
    container endpoint (removed — upstream never does this); it now
    resolves to a synthetic **group-anchor node id**, one per referenced
    cluster (`groupAnchorNodeId(clusterId)`), shared across every edge that
    targets the same group — mirrors `Cluster.getSpecialPointId` /
    `Bibliotekon.getNodeUid`'s group fallback exactly.
  - `buildDotEdges` collects the set of cluster ids needing an anchor
    (`groupAnchorClusterIds`); `buildDotNodes` emits one `shape:'point'`
    `DotInputNode` per id (size `.01in` = 0.72px, matching
    `width=.01,label=""`); `buildDotClusters` adds that node id as a direct
    member of the owning cluster (not nested in child sub-clusters) —
    matching `ClusterDotString.printInternal` line 149's placement (emitted
    at the parent cluster's own level, before its `i`/`p1` nesting).
  - Existing `containerEndpointsInfo`/`clipSplineStart`/`clipSplineEnd`
    (visual clipping to the container's rendered bbox) is UNCHANGED and
    still applies — mirrors upstream's *separate* Java-side
    `dotPath.simulateCompound` clip that happens in addition to the DOT-level
    anchor.
  - `classifyAsCluster`'s `clusterId` renamed from `c${n}` to `cluster${n}`
    (purely cosmetic to our own layout, since `graph-layout.ts`'s real
    `addClusters` always re-prefixes with `cluster_` regardless) — fixes the
    comparator-naming bug found in `balipa-82-feto843`/`balomu-94-kegi822`
    that made every one of our clusters invisible to `clusterOk`.

## Ledger additions (out of scope for this iteration)

- **Port/`EntityPosition` placeholder mechanism** ((a).2 above): needs a
  `port` USymbol / qualifier concept our AST doesn't have yet. Slug:
  `banatu-09-koce254` (component).
- **`style=invis` ordering edges** (`balomu-94-kegi822`): 2 oracle edges we
  never emit; looks unrelated to clusters (candidate: `together`/rank
  ordering hidden edges). Needs separate diagnosis.


## Before / after aggregate (`npx tsx scripts/dot-sync-report.ts component usecase`)

| Metric | component before | component after | usecase before | usecase after |
|---|---|---|---|---|
| structurally EQUAL | 44 (17%) | **91 (35%)** | 1 (1%) | **1 (1%)** |
| clusterOk fails | 91 | **31** | 15 | **10** |
| degreeOk fails | 111 | 104 | 33 | 31 |
| shapeOk fails | 104 | 95 | 50 | 50 |
| nodeCountOk fails | 71 | 61 | 25 | 23 |

usecase's EQUAL count didn't move because its remaining clusterOk/shapeOk
failures are dominated by the two newly-discovered, out-of-scope mechanisms
above (`together{}` sub-nesting, the edge-to-member redirect) rather than
the group-anchor mechanism this iteration implements — see the ledger.
