import type { DotWorkingGraph } from './types.js';

export function setAspect(_graph: DotWorkingGraph, _targetAspect: number): void {
  console.warn(
    'aspect attribute has been disabled due to implementation flaws — attribute ignored.',
  );
}
