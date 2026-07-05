/**
 * "Magma" standalone chaining — applySingleStrategy in net/atmp/CucaDiagram
 * .java (invoked from DescriptionDiagram.checkFinalError), Magma.java,
 * MagmaList.java, cucadiagram/SquareMaker.java.
 *
 * Per group (and root), leaves touched by NO link (isStandalone) are chained
 * into a square grid of INVISIBLE links when there are >= 3 of them:
 * left-right neighbors get invisible length-1 links (minlen 0); each row head
 * links to the next row head with an invisible length-2 link (minlen 1).
 * When >= 3 groups' magmas share the same parent container, the magmas
 * themselves are square-chained (topRight -> topLeft length 1, bottomLeft ->
 * topLeft length 2).
 */
import type { DotInputEdge } from '../../core/graph-layout.js';

/** SquareMaker.computeBranch: ceil(sqrt(n)), exact r for perfect squares. */
export function computeBranch(size: number): number {
  const r = Math.floor(Math.sqrt(size));
  return r * r === size ? r : r + 1;
}

/** SquareMaker.getBottomLeft: first slot of the last full row. */
function getBottomLeft(size: number): number {
  const s = computeBranch(size);
  return Math.floor((size - 1) / s) * s;
}

interface SquareLinker<T> {
  topDown(a: T, b: T): void;
  leftRight(a: T, b: T): void;
}

/** SquareMaker.putInSquare — verbatim iteration order. */
function putInSquare<T>(data: readonly T[], linker: SquareLinker<T>): void {
  const branch = computeBranch(data.length);
  let headBranch = 0;
  for (let i = 1; i < data.length; i++) {
    const dist = i - headBranch;
    if (dist === branch) {
      linker.topDown(data[headBranch]!, data[i]!);
      headBranch = i;
    } else {
      linker.leftRight(data[i - 1]!, data[i]!);
    }
  }
}

/** One group's standalone-leaf square (Magma.java). */
interface MagmaSquare {
  /** The group's parent container ast id; undefined = the root container. */
  parentAstId: string | undefined;
  /** Standalone leaf dot ids in declaration order. */
  members: readonly string[];
}

const topLeft = (m: MagmaSquare): string => m.members[0]!;
const topRight = (m: MagmaSquare): string =>
  m.members[computeBranch(m.members.length) - 1] ?? m.members[m.members.length - 1]!;
const bottomLeft = (m: MagmaSquare): string => m.members[getBottomLeft(m.members.length)]!;

export interface MagmaGroupInput {
  /** undefined for the root pseudo-group (its magma never inter-chains —
   *  upstream Magma.getContainer() is the group's parent, null for root). */
  astId: string | undefined;
  parentAstId: string | undefined;
  /** The group's DIRECT leaf dot ids, declaration order. */
  leafDotIds: readonly string[];
}

/**
 * applySingleStrategy: build the invisible chaining edges for a diagram.
 *
 * @param groups   root pseudo-group + every container, each with its direct
 *                 leaves in declaration order.
 * @param touched  dot node ids that appear as an endpoint of any real edge
 *                 (upstream isStandalone: any diagram link touching the
 *                 entity, hidden/invisible included).
 */
export function buildMagmaEdges(
  groups: readonly MagmaGroupInput[],
  touched: ReadonlySet<string>,
): DotInputEdge[] {
  const edges: DotInputEdge[] = [];
  let n = 0;
  const push = (from: string, to: string, length: number): void => {
    edges.push({
      id: `magma-edge-${n++}`,
      from,
      to,
      attributes: { minLen: length - 1, invis: true },
    });
  };

  const magmas: MagmaSquare[] = [];
  for (const g of groups) {
    const standalones = g.leafDotIds.filter((id) => !touched.has(id));
    if (standalones.length < 3) continue;
    putInSquare(standalones, {
      topDown: (a, b) => push(a, b, 2),
      leftRight: (a, b) => push(a, b, 1),
    });
    // Root-group magmas have no container-parent and never inter-chain.
    if (g.astId !== undefined) {
      magmas.push({ parentAstId: g.parentAstId, members: standalones });
    }
  }

  chainMagmas(magmas, push);
  return edges;
}

/** MagmaList.putInSquare: >= 3 magmas under the same parent chain together. */
function chainMagmas(
  magmas: readonly MagmaSquare[],
  push: (from: string, to: string, length: number) => void,
): void {
  const byParent = new Map<string, MagmaSquare[]>();
  for (const m of magmas) {
    const key = m.parentAstId ?? '';
    const arr = byParent.get(key) ?? [];
    arr.push(m);
    byParent.set(key, arr);
  }
  for (const group of byParent.values()) {
    if (group.length < 3) continue;
    putInSquare(group, {
      topDown: (a, b) => push(bottomLeft(a), topLeft(b), 2),
      leftRight: (a, b) => push(topRight(a), topLeft(b), 1),
    });
  }
}

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
