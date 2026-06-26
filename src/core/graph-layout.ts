// The single graph-layout chokepoint.
//
// All six graph diagram types (class, component, state, usecase, dot, json)
// route their layout through `layoutGraph()` — the only seam consumer. The
// in-house graphviz engines have been removed (see
// plans/burn-graphviz-engines/); this seam currently throws and is wired to the
// `graphviz-ts` package by the follow-on adapter mission.

import type {
  DotInputNode,
  DotInputEdge,
  DotInputGraph,
  DotLayoutResult,
} from './graph-layout.types.js';

/**
 * Thrown by `layoutGraph()` until the graphviz-ts adapter mission wires the
 * seam. Named (not a generic Error) so each throw-site is loud and greppable —
 * every catch of this is a work item for the adapter mission.
 */
export class PendingGraphvizError extends Error {
  constructor(message?: string) {
    super(
      message ??
        'Graph layout is not yet wired to graphviz-ts. The in-house engines were ' +
          'removed by the burn-graphviz-engines mission; the adapter mission wires ' +
          'this seam to graphviz-ts. See plans/burn-graphviz-engines/handoff-adapter.md.',
    );
    this.name = 'PendingGraphvizError';
  }
}

/**
 * Lay out a graph. The single seam between the graph diagram types and the
 * layout engine.
 *
 * @param input - the graph to lay out (node/edge geometry + rank hints).
 * @param opts  - layout options; `engine` selects a graphviz layout engine
 *                (dot/neato/fdp/sfdp/twopi/circo/osage) once the adapter is wired.
 * @throws PendingGraphvizError - always, until the adapter mission wires graphviz-ts.
 */
export function layoutGraph(
  input: DotInputGraph,
  opts?: { engine?: string },
): DotLayoutResult {
  void input;
  void opts;
  throw new PendingGraphvizError();
}

export type { DotInputNode, DotInputEdge, DotInputGraph, DotLayoutResult };
