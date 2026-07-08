/**
 * Description-engine binding for the shared "Magma" standalone-chaining feature.
 * The generic algorithm (SquareMaker/Magma/MagmaList port) lives in
 * `src/core/magma.ts`; this module only builds the description engine's
 * `MagmaGroupInput[]` from its layout ClassifyCtx.
 */
import { buildMagmaEdges, type MagmaGroupInput } from '../../core/magma.js';

export { buildMagmaEdges, type MagmaGroupInput };

/** The slice of the layout's ClassifyCtx that magma grouping needs. */
export interface MagmaCtxLike {
  containers: ReadonlyArray<{
    astId: string;
    parentAstId?: string;
    directLeafAstIds: readonly string[];
  }>;
  leafIdSet: ReadonlySet<string>;
  astNodeById: ReadonlyMap<string, { declaredAsGroup?: true }>;
}

/** Root pseudo-group + every container with its direct leaves, declaration
 *  order — the `groupsAndRoot()` iteration applySingleStrategy walks. */
export function magmaGroups(ctx: MagmaCtxLike): MagmaGroupInput[] {
  const containedLeafIds = new Set(
    ctx.containers.flatMap((c) => c.directLeafAstIds),
  );
  // Empty braced groups render as leaves but are still GROUP entities when
  // applySingleStrategy runs upstream — they never count as standalones.
  const isMagmaLeaf = (id: string): boolean =>
    ctx.leafIdSet.has(id) && ctx.astNodeById.get(id)?.declaredAsGroup !== true;
  const rootLeaves = [...ctx.astNodeById.keys()].filter(
    (id) => isMagmaLeaf(id) && !containedLeafIds.has(id),
  );
  const groups: MagmaGroupInput[] = [
    { astId: undefined, parentAstId: undefined, leafDotIds: rootLeaves },
  ];
  for (const c of ctx.containers) {
    groups.push({
      astId: c.astId,
      parentAstId: c.parentAstId,
      leafDotIds: c.directLeafAstIds.filter(isMagmaLeaf),
    });
  }
  return groups;
}
