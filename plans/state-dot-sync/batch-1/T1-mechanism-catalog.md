# T1 — Svek-state mechanism catalog (investigation, read-only on src)

## Context
A2's mid-mission "scope correction" proved investigation-first pays:
the brief's assumptions must be replaced by verified facts before the
structural port (T3/T4) is specced in detail. The oracle dumps are
cached (`test-results/dot-cache/state/<slug>/svek-N.dot` + in.puml).

## Task
Write `plans/state-dot-sync/mechanisms.md` (≤300 lines, tables first)
documenting, each with Java file:line citations AND a named oracle
fixture exhibiting it:
1. **Node shape/size table** per state kind: simple state
   (EntityImageState — rounded rect; verify the 0.694444in height
   formula), empty-description variant (+`hide empty description`
   interplay), circle start/end (0.277778in), history H/H*, fork/join
   (SYNCHRO_BAR), choice, `<<sdlreceive>>` (EntityImageState2), deep
   history, entry/exit border points (EntityImageStateBorder +
   EntityPosition).
2. **Cluster envelope grammar**: exact subgraph nesting/naming
   (`cluster{N}a`/`p0`/`{N}`/`i`/`p1`), which layers appear when
   (concurrent regions vs plain composite), `zaent` anchor points,
   label tables, style/color attrs (ClusterDotString.java + Cluster.java).
3. **Autonom decision rule**: when a composite gets a child svek pass
   vs a cluster (GroupMakerState.java, InnerStateAutonom.java) — the
   precise link-crossing predicate; child-pass dump ORDER relative to
   the parent; which graph attrs child passes omit (bemena's svek-1
   lacks nodesep/ranksep — confirm rule).
4. **Edge conventions**: minlen source (arrow length), label HTML
   tables, tail/head labels, [*]-target final-state edge specifics,
   entry/exit port `:P` suffixes if any.
5. **Graph attrs**: nodesep/ranksep values + floors, rankdir handling.
6. **Bucket→mechanism map**: for each baseline bucket (graph-count 118,
   shape 174, nodesep 174, cluster 30, …) name the mechanism(s) above
   that explain it, with 2-3 drilled fixtures each
   (`npx tsx scripts/dot-sync-report.ts --slug <slug> state`).

## Write-set
- plans/state-dot-sync/mechanisms.md ONLY (no src changes).

## Read-set
- ~/git/plantuml/.../svek/{GroupMakerState,InnerStateAutonom,Cluster,ClusterDotString,GeneralImageBuilder}.java
- ~/git/plantuml/.../svek/image/EntityImageState*.java, EntityImageCircle*.java, EntityImageSynchroBar.java
- ~/git/plantuml/.../statediagram/ + statediagram/command/
- test-results/dot-cache/state/ (drills), src/diagrams/state/ (current gaps), src/diagrams/class/class-dot-graph.ts (established svek conventions)

## Acceptance criteria
- Given mechanisms.md, then every baseline bucket has a named mechanism
  with Java citation + fixture evidence.
- Given the autonom rule section, then bemena-23-zebu249's 2-pass
  structure is fully explained (which composite went which path & why).

## Observability
N/A. **Rollback:** Reversible (doc only).

## Commit
`docs(state-dot): svek-state mechanism catalog (T1)`
