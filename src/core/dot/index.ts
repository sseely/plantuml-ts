import type { DotInputGraph, DotLayoutResult } from './types.js';

export function layout(_input: DotInputGraph): DotLayoutResult {
  throw new Error('dot layout not yet implemented');
}

export type {
  DotInputGraph,
  DotInputNode,
  DotInputEdge,
  DotLayoutResult,
  DotWorkingGraph,
  DotNode,
  DotEdge,
} from './types.js';
