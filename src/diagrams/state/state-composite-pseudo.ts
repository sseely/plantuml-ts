/**
 * Scope-local `[*]`-pseudostate anchor id resolution + creation-order
 * sibling sorting — split out of `state-composite-pass.ts` (mission G4 S7,
 * 500-line file-cap compliance; pure move, no behavior change). Re-exported
 * from `state-composite-pass.ts` so every pre-existing importer keeps
 * working unchanged (mirrors `state-parse-state.ts`'s own S7 split of
 * `state-pseudokind.ts`, same rationale).
 *
 * Type-only imports back from `state-composite-pass.ts` (`GeoSpec`/
 * `PassAccumulator`/`DiagramCtx`) are erased at compile time — no runtime
 * circular-import risk, the SAME accepted pattern
 * `state-composite-autonom.ts`/`state-composite-concurrent.ts` already
 * establish for this file pair (S3/S6 decision journal entries).
 */

import type { Transition } from './ast.js';
import type { GeoSpec, PassAccumulator, DiagramCtx } from './state-composite-pass.js';
import { CIRCLE_START_SIZE, CIRCLE_END_SIZE } from './state-sizing.js';
import { resolveEndpoint } from './state-composite-classify.js';
import { pseudoTickKey } from './state-parse-state.js';

/** One `[*]`-referencing scope's local start/end anchor ids — scoped per
 *  composite (own id) or '' for the top level (pre-existing per-scope
 *  convention, StateDiagram#getStart/getEnd). */
export function scopedPseudoIds(scopeId: string): { initialId: string; finalId: string } {
  return scopeId === ''
    ? { initialId: '__initial__', finalId: '__final__' }
    : { initialId: `__init_${scopeId}`, finalId: `__final_${scopeId}` };
}

function usesPseudo(transitions: readonly Transition[]): { start: boolean; end: boolean } {
  return {
    start: transitions.some((t) => t.from === '[*]'),
    end: transitions.some((t) => t.to === '[*]'),
  };
}

/**
 * mission G4 S7 (mechanism 10, id-numbering creation-index gap): sorts a
 * `GeoSpec` sibling list into jar's real DOCUMENT order -- true parse-time
 * creation order, NOT the S5-era "real states first, pseudo last" heuristic
 * (`nelupe-49-xova546` jar-verified counter-example: `toutou9`, declared
 * EARLY at tick 3, sorts BEFORE its own owning region's `[*]`-pseudo anchor,
 * tick 11, even though the pseudo anchor's OWN transition textually
 * references `toutou9` -- upstream draws each pass's children in the SAME
 * order its `Entity`/`Quark` tree was built, not grouped by kind). Stable
 * (`Array#sort` is stable since ES2019) -- specs WITHOUT a `creationIndex`
 * (the one still-unthreaded edge case named in the S7 ledger,
 * `state-composite-cluster.ts#buildConcurrentRegionLeaf`'s synthetic
 * region-as-node id) sort to the END, keeping their PRE-EXISTING relative
 * order among themselves. Callers apply this to EACH region's own spec list
 * BEFORE concatenating into a composite's flat `children`/`localStates`
 * (never to the already-concatenated flat array itself) -- reordering
 * within a region cannot cross a region boundary, which would corrupt
 * `state-composite-geo.ts#materializeAutonom`'s own "flat arrays are a
 * concatenation of the per-region ones" identity-sharing contract (mission
 * G4 S6).
 */
export function sortSpecsByCreationIndex<T extends { creationIndex?: number }>(specs: readonly T[]): T[] {
  return [...specs].sort((a, b) => (a.creationIndex ?? Infinity) - (b.creationIndex ?? Infinity));
}

export function addLocalPseudoNodes(
  scopeId: string,
  transitions: readonly Transition[],
  acc: PassAccumulator,
  pseudoCreationIndex: ReadonlyMap<string, number> = new Map(),
): GeoSpec[] {
  const { start, end } = usesPseudo(transitions);
  if (!start && !end) return [];
  const { initialId, finalId } = scopedPseudoIds(scopeId);
  const specs: GeoSpec[] = [];
  if (start) {
    acc.nodes.push({ id: initialId, width: CIRCLE_START_SIZE, height: CIRCLE_START_SIZE, shape: 'circle' });
    const ci = pseudoCreationIndex.get(pseudoTickKey(scopeId, 'start'));
    specs.push({ kind: 'state', id: initialId, stateKind: 'initial', display: '', ...(ci !== undefined ? { creationIndex: ci } : {}) });
  }
  if (end) {
    acc.nodes.push({ id: finalId, width: CIRCLE_END_SIZE, height: CIRCLE_END_SIZE, shape: 'circle' });
    const ci = pseudoCreationIndex.get(pseudoTickKey(scopeId, 'end'));
    specs.push({ kind: 'state', id: finalId, stateKind: 'final', display: '', ...(ci !== undefined ? { creationIndex: ci } : {}) });
  }
  return specs;
}

export function levelEndpointId(raw: string, isFrom: boolean, scopeId: string, ctx: DiagramCtx): string {
  if (raw === '[*]') {
    const { initialId, finalId } = scopedPseudoIds(scopeId);
    return isFrom ? initialId : finalId;
  }
  return resolveEndpoint(raw, ctx.classify);
}
