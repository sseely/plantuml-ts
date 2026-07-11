# T4 — Composite states: child passes + cluster envelopes

## Context
The 118 graph-count mismatches. Decision D2 (verified on
bemena-23-zebu249): autonom composites → child svek pass (dumped
before the parent, child passes omit graph attrs per mechanisms.md) →
fixed-size rounded-rect node in the parent; non-autonom → nested
cluster envelope (`cluster{N}a`/`p0`/`{N}`/`i`/`p1`, `zaent` anchors);
concurrent regions = the p0/p1 parts. mechanisms.md#autonom and
#envelope are the authoritative spec.

## Task
1. Port GroupMakerState's autonom predicate + child-pass flow: run
   inner layout() calls in the oracle's dump ORDER (the seam observer
   captures each — comparator pairs graph #i with svek-(i+1)).
2. Port the cluster envelope emission for non-autonom composites and
   concurrent regions; extend `svek-dot-emit.ts`/`graph-layout.types.ts`
   ADDITIVE-ONLY where DotInputCluster cannot express the envelope
   (D3; reuse portRanks/portAnchorId machinery for entry/exit border
   points — description engine precedent at description/layout.ts).
3. Entry/exit border-point nodes (EntityImageStateBorder) on cluster
   borders.
4. TDD: bemena-23-zebu249 end-to-end (2 captures, pass order, child
   attrs) + one concurrent-region fixture + one entry/exit fixture,
   all pinned to cached oracle DOT.
5. Measure + report EQUAL delta and remaining buckets (Phase L seeds).

## Write-set
- src/diagrams/state/**; src/core/svek-dot-emit.ts,
  src/core/graph-layout.types.ts (additive only — sibling ratchets
  guard); tests/unit/state/**, tests/unit/core? (emitter unit tests
  live where existing emitter tests are — locate first)

## Read-set
- plans/state-dot-sync/mechanisms.md (authoritative)
- ~/git/plantuml/.../svek/{GroupMakerState,InnerStateAutonom,Cluster,ClusterDotString}.java
- src/diagrams/description/layout.ts:191-205 (portRanks precedent)
- src/core/svek-dot-emit.ts (current envelope support)

## Acceptance criteria
- Given bemena-23-zebu249, then 2 captured graphs pairing EQUAL-wise
  with svek-1/svek-2 (test).
- Given `npm test`, then class(687)/object(78)/description ratchets
  green — else STOP (condition 4).
- Given the report, then graph-count mismatch drops substantially;
  journal the number.

## Observability
N/A. **Rollback:** Reversible.

## Commit
`feat(state-dot): composite child passes + cluster envelopes (T4)`
