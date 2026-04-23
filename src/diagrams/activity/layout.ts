/**
 * Activity diagram layout engine.
 *
 * Produces geometry for all nodes and edges in an activity diagram AST.
 * Layout proceeds top-to-bottom with sequential placement. Composite nodes
 * (if/fork/while/repeat) are expanded inline and their children placed in
 * side-by-side columns.
 */

import type {
  ActivityDiagramAST,
  ActivityNode,
  ActivityIf,
  ActivityFork,
  ActivitySplit,
  ActivityWhile,
  ActivityRepeat,
} from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { FontSpec, StringMeasurer } from '../../core/measurer.js';

// ---------------------------------------------------------------------------
// Public geometry types
// ---------------------------------------------------------------------------

export interface ActivityNodeGeo {
  id: string;
  kind: string;
  label?: string;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ActivityEdgeGeo {
  points: Array<{ x: number; y: number }>;
  label?: string;
}

export interface SwimlaneGeo {
  name: string;
  x: number;
  width: number;
}

export interface ActivityGeometry {
  totalWidth: number;
  totalHeight: number;
  nodes: ActivityNodeGeo[];
  edges: ActivityEdgeGeo[];
  swimlanes: SwimlaneGeo[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_MARGIN_Y = 20;
const NODE_MARGIN_X = 40;
const START_STOP_RADIUS = 10;
const STOP_OUTER_RADIUS = 14;
const ACTION_MIN_WIDTH = 100;
const ACTION_HEIGHT = 36;
const ACTION_H_PAD = 16;
const BAR_HEIGHT = 8;
const SWIMLANE_HEADER_H = 28;
const SWIMLANE_MIN_WIDTH = 120;
const DEFAULT_WIDTH = 600;
const LAYOUT_MARGIN = 12;

const DIAMOND_SIZE = 20;

// ---------------------------------------------------------------------------
// Internal layout context
// ---------------------------------------------------------------------------

interface LayoutCtx {
  theme: Theme;
  measurer: StringMeasurer;
  /** Maps swimlane name → left x of the lane. Empty when no swimlanes. */
  laneX: Map<string, number>;
  /** Width of each lane. 0 when no swimlanes. */
  laneWidth: number;
  /** Total canvas width. */
  canvasWidth: number;
  /** Counters for sequential node ids. */
  counters: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextId(ctx: LayoutCtx, prefix: string): string {
  const current = ctx.counters.get(prefix) ?? 0;
  ctx.counters.set(prefix, current + 1);
  return `${prefix}-${current}`;
}

function measureText(
  text: string,
  ctx: LayoutCtx,
): { width: number; height: number } {
  const font: FontSpec = {
    family: ctx.theme.fontFamily,
    size: ctx.theme.fontSize,
  };
  return ctx.measurer.measure(text, font);
}

function actionSize(
  label: string,
  ctx: LayoutCtx,
): { width: number; height: number } {
  const measured = measureText(label, ctx);
  return {
    width: Math.max(ACTION_MIN_WIDTH, measured.width + ACTION_H_PAD * 2),
    height: ACTION_HEIGHT,
  };
}

/**
 * Returns the x-center for a node given swimlane context.
 * When swimlanes are active and the node has a lane, uses that lane's center.
 * Otherwise uses the canvas center.
 */
function nodeCenterX(swimlane: string | undefined, ctx: LayoutCtx): number {
  if (swimlane !== undefined && ctx.laneX.size > 0) {
    const lx = ctx.laneX.get(swimlane);
    if (lx !== undefined) {
      return lx + ctx.laneWidth / 2;
    }
  }
  return ctx.canvasWidth / 2;
}

// ---------------------------------------------------------------------------
// Branch layout result
// ---------------------------------------------------------------------------

interface BranchResult {
  nodes: ActivityNodeGeo[];
  edges: ActivityEdgeGeo[];
  /** y of the bottom of the last placed element. */
  bottomY: number;
  /** Width consumed by this branch column. */
  width: number;
  /** Id of first node in branch (for edge connections). */
  firstId: string | undefined;
  /** Id of last node in branch (for edge connections). */
  lastId: string | undefined;
}

// ---------------------------------------------------------------------------
// Core recursive layout
// ---------------------------------------------------------------------------

/**
 * Lay out a sequence of ActivityNodes starting at `startY`, horizontally
 * centered at `centerX`. Returns nodes, edges, and the y below the last node.
 */
function layoutSequence(
  nodes: readonly ActivityNode[],
  startY: number,
  centerX: number,
  ctx: LayoutCtx,
): BranchResult {
  const outNodes: ActivityNodeGeo[] = [];
  const outEdges: ActivityEdgeGeo[] = [];
  let currentY = startY;
  let firstId: string | undefined;
  let lastId: string | undefined;

  for (const node of nodes) {
    const result = layoutNode(node, currentY, centerX, ctx);
    outNodes.push(...result.nodes);
    outEdges.push(...result.edges);

    // Connect previous last node to this node's first node
    if (lastId !== undefined && result.firstId !== undefined) {
      const fromNode = outNodes.find((n) => n.id === lastId);
      const toNode = outNodes.find((n) => n.id === result.firstId);
      if (fromNode !== undefined && toNode !== undefined) {
        outEdges.push({
          points: [
            { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height },
            { x: toNode.x + toNode.width / 2, y: toNode.y },
          ],
        });
      }
    }

    if (firstId === undefined) {
      firstId = result.firstId;
    }
    lastId = result.lastId;
    currentY = result.bottomY + NODE_MARGIN_Y;
  }

  // bottomY is the last placed y (before the trailing margin)
  const bottomY = currentY > startY ? currentY - NODE_MARGIN_Y : startY;

  // Compute branch width from contained nodes
  let maxRight = 0;
  let minLeft = Infinity;
  for (const n of outNodes) {
    if (n.x < minLeft) minLeft = n.x;
    if (n.x + n.width > maxRight) maxRight = n.x + n.width;
  }
  const width = outNodes.length > 0 ? maxRight - minLeft : 0;

  return { nodes: outNodes, edges: outEdges, bottomY, width, firstId, lastId };
}

/**
 * Lay out a single ActivityNode at the given position.
 * Returns the placed node(s), generated edges, the bottom y, and
 * the first/last node ids for edge connection purposes.
 */
function layoutNode(
  node: ActivityNode,
  startY: number,
  centerX: number,
  ctx: LayoutCtx,
): BranchResult {
  switch (node.kind) {
    case 'start':
      return layoutStart(node.swimlane, startY, ctx);

    case 'stop':
    case 'end':
    case 'kill':
      return layoutStop(node.kind, node.swimlane, startY, ctx);

    case 'detach': {
      // Treat detach like a stop visually
      return layoutStop('stop', node.swimlane, startY, ctx);
    }

    case 'action':
      return layoutAction(node.label, node.color, node.swimlane, startY, ctx);

    case 'if':
      return layoutIf(node, startY, centerX, ctx);

    case 'fork':
      return layoutFork(node, startY, centerX, ctx);

    case 'split':
      return layoutSplit(node, startY, centerX, ctx);

    case 'while':
      return layoutWhile(node, startY, centerX, ctx);

    case 'repeat':
      return layoutRepeat(node, startY, centerX, ctx);

    case 'note': {
      // Notes are small boxes placed to the side; treat like a short action
      const id = nextId(ctx, 'note');
      const sz = actionSize(node.text, ctx);
      const geo: ActivityNodeGeo = {
        id,
        kind: 'note',
        label: node.text,
        x: centerX - sz.width / 2,
        y: startY,
        width: sz.width,
        height: sz.height,
      };
      return {
        nodes: [geo],
        edges: [],
        bottomY: startY + sz.height,
        width: sz.width,
        firstId: id,
        lastId: id,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Leaf node layouts
// ---------------------------------------------------------------------------

function layoutStart(
  swimlane: string | undefined,
  startY: number,
  ctx: LayoutCtx,
): BranchResult {
  const cx = nodeCenterX(swimlane, ctx);
  const diameter = START_STOP_RADIUS * 2;
  const id = 'start';
  const geo: ActivityNodeGeo = {
    id,
    kind: 'start',
    x: cx - START_STOP_RADIUS,
    y: startY,
    width: diameter,
    height: diameter,
  };
  return {
    nodes: [geo],
    edges: [],
    bottomY: startY + diameter,
    width: diameter,
    firstId: id,
    lastId: id,
  };
}

function layoutStop(
  kind: 'stop' | 'end' | 'kill',
  swimlane: string | undefined,
  startY: number,
  ctx: LayoutCtx,
): BranchResult {
  const cx = nodeCenterX(swimlane, ctx);
  const diameter = STOP_OUTER_RADIUS * 2;
  const id = nextId(ctx, kind);
  const geo: ActivityNodeGeo = {
    id,
    kind,
    x: cx - STOP_OUTER_RADIUS,
    y: startY,
    width: diameter,
    height: diameter,
  };
  return {
    nodes: [geo],
    edges: [],
    bottomY: startY + diameter,
    width: diameter,
    firstId: id,
    lastId: id,
  };
}

function layoutAction(
  label: string,
  color: string | undefined,
  swimlane: string | undefined,
  startY: number,
  ctx: LayoutCtx,
): BranchResult {
  const cx = nodeCenterX(swimlane, ctx);
  const sz = actionSize(label, ctx);
  const id = nextId(ctx, 'action');
  const geo: ActivityNodeGeo = {
    id,
    kind: 'action',
    label,
    x: cx - sz.width / 2,
    y: startY,
    width: sz.width,
    height: sz.height,
  };
  if (color !== undefined) {
    geo.color = color;
  }
  return {
    nodes: [geo],
    edges: [],
    bottomY: startY + sz.height,
    width: sz.width,
    firstId: id,
    lastId: id,
  };
}

// ---------------------------------------------------------------------------
// If / else layout
// ---------------------------------------------------------------------------

function layoutIf(
  node: ActivityIf,
  startY: number,
  centerX: number,
  ctx: LayoutCtx,
): BranchResult {
  const splitId = nextId(ctx, 'if-split');

  // Place the decision diamond
  const splitGeo: ActivityNodeGeo = {
    id: splitId,
    kind: 'if-split',
    label: node.condition,
    x: centerX - DIAMOND_SIZE / 2,
    y: startY,
    width: DIAMOND_SIZE,
    height: DIAMOND_SIZE,
  };

  const splitBottomY = startY + DIAMOND_SIZE;
  const branchStartY = splitBottomY + NODE_MARGIN_Y;

  // Collect all branches: thenBranch, elseIfBranches, elseBranch
  type BranchEntry = { nodes: readonly ActivityNode[]; label?: string };
  const thenEntry: BranchEntry = {
    nodes: node.thenBranch,
    ...(node.thenLabel !== undefined ? { label: node.thenLabel } : {}),
  };
  const elseEntry: BranchEntry = {
    nodes: node.elseBranch,
    ...(node.elseLabel !== undefined ? { label: node.elseLabel } : {}),
  };
  const elseIfEntries: BranchEntry[] = node.elseIfBranches.map((eif) => ({
    nodes: eif.body,
    label: eif.label ?? eif.condition,
  }));
  const allBranches: BranchEntry[] = [thenEntry, ...elseIfEntries, elseEntry];

  const branchCount = allBranches.length;

  // Measure each branch to determine column widths
  // We need a scratch context to measure without mutating real counters
  const branchResults: BranchResult[] = [];

  // Compute column widths per branch (use max action width as column width)
  const colWidths: number[] = allBranches.map(() => ACTION_MIN_WIDTH + ACTION_H_PAD * 2);

  const totalBranchWidth =
    colWidths.reduce((s, w) => s + w, 0) +
    NODE_MARGIN_X * (branchCount - 1);

  // Lay out each branch in a separate column
  let colLeft = centerX - totalBranchWidth / 2;
  let maxBranchBottom = branchStartY;

  const allBranchNodes: ActivityNodeGeo[] = [];
  const allBranchEdges: ActivityEdgeGeo[] = [];
  const branchFirstIds: (string | undefined)[] = [];
  const branchLastIds: (string | undefined)[] = [];

  for (let i = 0; i < allBranches.length; i++) {
    const colWidth = colWidths[i]!;
    const colCenterX = colLeft + colWidth / 2;
    const branch = allBranches[i]!;

    const result = layoutSequence(branch.nodes, branchStartY, colCenterX, ctx);
    branchResults.push(result);
    branchFirstIds.push(result.firstId);
    branchLastIds.push(result.lastId);

    allBranchNodes.push(...result.nodes);
    allBranchEdges.push(...result.edges);

    if (result.bottomY > maxBranchBottom) {
      maxBranchBottom = result.bottomY;
    }

    colLeft += colWidth + NODE_MARGIN_X;
  }

  // Place merge diamond below all branches
  const mergeY = maxBranchBottom + NODE_MARGIN_Y;
  const mergeId = nextId(ctx, 'if-merge');
  const mergeGeo: ActivityNodeGeo = {
    id: mergeId,
    kind: 'if-merge',
    x: centerX - DIAMOND_SIZE / 2,
    y: mergeY,
    width: DIAMOND_SIZE,
    height: DIAMOND_SIZE,
  };

  const outEdges: ActivityEdgeGeo[] = [...allBranchEdges];

  // Edges from split diamond to each branch start
  colLeft = centerX - totalBranchWidth / 2;
  for (let i = 0; i < allBranches.length; i++) {
    const colWidth = colWidths[i]!;
    const colCenterX = colLeft + colWidth / 2;
    const firstId = branchFirstIds[i];
    const branch = allBranches[i]!;

    if (firstId !== undefined) {
      const firstNode = allBranchNodes.find((n) => n.id === firstId);
      if (firstNode !== undefined) {
        const edgeGeo: ActivityEdgeGeo = {
          points: [
            { x: centerX, y: splitBottomY },
            { x: firstNode.x + firstNode.width / 2, y: firstNode.y },
          ],
        };
        if (branch.label !== undefined) {
          edgeGeo.label = branch.label;
        }
        outEdges.push(edgeGeo);
      }
    } else {
      // Empty branch — connect split directly to merge
      const edgeGeo: ActivityEdgeGeo = {
        points: [
          { x: centerX, y: splitBottomY },
          { x: colCenterX, y: branchStartY },
          { x: centerX, y: mergeY },
        ],
      };
      if (branch.label !== undefined) {
        edgeGeo.label = branch.label;
      }
      outEdges.push(edgeGeo);
    }

    colLeft += colWidth + NODE_MARGIN_X;
  }

  // Edges from each branch end to merge diamond
  for (let i = 0; i < allBranches.length; i++) {
    const lastId = branchLastIds[i];
    if (lastId !== undefined) {
      const lastNode = allBranchNodes.find((n) => n.id === lastId);
      if (lastNode !== undefined) {
        outEdges.push({
          points: [
            { x: lastNode.x + lastNode.width / 2, y: lastNode.y + lastNode.height },
            { x: centerX, y: mergeY },
          ],
        });
      }
    }
  }

  const outNodes: ActivityNodeGeo[] = [splitGeo, ...allBranchNodes, mergeGeo];

  return {
    nodes: outNodes,
    edges: outEdges,
    bottomY: mergeY + DIAMOND_SIZE,
    width: totalBranchWidth,
    firstId: splitId,
    lastId: mergeId,
  };
}

// ---------------------------------------------------------------------------
// Fork layout
// ---------------------------------------------------------------------------

function layoutFork(
  node: ActivityFork,
  startY: number,
  centerX: number,
  ctx: LayoutCtx,
): BranchResult {
  return layoutParallelBranches('fork', node.branches, startY, centerX, ctx);
}

function layoutSplit(
  node: ActivitySplit,
  startY: number,
  centerX: number,
  ctx: LayoutCtx,
): BranchResult {
  return layoutParallelBranches('split', node.branches, startY, centerX, ctx);
}

function layoutParallelBranches(
  barKind: 'fork' | 'split',
  branches: readonly (readonly ActivityNode[])[],
  startY: number,
  centerX: number,
  ctx: LayoutCtx,
): BranchResult {
  const branchCount = branches.length;

  // Minimum column width for each branch
  const colWidths: number[] = branches.map(
    () => ACTION_MIN_WIDTH + ACTION_H_PAD * 2,
  );
  const totalBranchWidth =
    colWidths.reduce((s, w) => s + w, 0) + NODE_MARGIN_X * (branchCount - 1);

  // Ensure bar is at least as wide as the total branch area
  const barWidth = totalBranchWidth;

  const forkBarKind = barKind === 'fork' ? 'fork-bar' : 'split-bar';
  const forkBarId = nextId(ctx, forkBarKind);
  const forkBarGeo: ActivityNodeGeo = {
    id: forkBarId,
    kind: forkBarKind,
    x: centerX - barWidth / 2,
    y: startY,
    width: barWidth,
    height: BAR_HEIGHT,
  };

  const forkBarBottomY = startY + BAR_HEIGHT;
  const branchStartY = forkBarBottomY + NODE_MARGIN_Y;

  let maxBranchBottom = branchStartY;
  const allBranchNodes: ActivityNodeGeo[] = [];
  const allBranchEdges: ActivityEdgeGeo[] = [];
  const branchFirstIds: (string | undefined)[] = [];
  const branchLastIds: (string | undefined)[] = [];

  let colLeft = centerX - barWidth / 2;
  for (let i = 0; i < branches.length; i++) {
    const colWidth = colWidths[i]!;
    const colCenterX = colLeft + colWidth / 2;
    const branch = branches[i]!;

    const result = layoutSequence(branch, branchStartY, colCenterX, ctx);
    branchFirstIds.push(result.firstId);
    branchLastIds.push(result.lastId);

    allBranchNodes.push(...result.nodes);
    allBranchEdges.push(...result.edges);

    if (result.bottomY > maxBranchBottom) {
      maxBranchBottom = result.bottomY;
    }

    colLeft += colWidth + NODE_MARGIN_X;
  }

  // Join bar below all branches
  const joinBarY = maxBranchBottom + NODE_MARGIN_Y;
  const joinBarId = nextId(ctx, 'join-bar');
  const joinBarGeo: ActivityNodeGeo = {
    id: joinBarId,
    kind: 'join-bar',
    x: centerX - barWidth / 2,
    y: joinBarY,
    width: barWidth,
    height: BAR_HEIGHT,
  };

  const outEdges: ActivityEdgeGeo[] = [...allBranchEdges];

  // Fork bar → branch starts
  colLeft = centerX - barWidth / 2;
  for (let i = 0; i < branches.length; i++) {
    const colWidth = colWidths[i]!;
    const colCenterX = colLeft + colWidth / 2;
    const firstId = branchFirstIds[i];

    if (firstId !== undefined) {
      const firstNode = allBranchNodes.find((n) => n.id === firstId);
      if (firstNode !== undefined) {
        outEdges.push({
          points: [
            { x: colCenterX, y: forkBarBottomY },
            { x: firstNode.x + firstNode.width / 2, y: firstNode.y },
          ],
        });
      }
    }

    colLeft += colWidth + NODE_MARGIN_X;
  }

  // Branch ends → join bar
  colLeft = centerX - barWidth / 2;
  for (let i = 0; i < branches.length; i++) {
    const colWidth = colWidths[i]!;
    const colCenterX = colLeft + colWidth / 2;
    const lastId = branchLastIds[i];

    if (lastId !== undefined) {
      const lastNode = allBranchNodes.find((n) => n.id === lastId);
      if (lastNode !== undefined) {
        outEdges.push({
          points: [
            { x: lastNode.x + lastNode.width / 2, y: lastNode.y + lastNode.height },
            { x: colCenterX, y: joinBarY },
          ],
        });
      }
    }

    colLeft += colWidth + NODE_MARGIN_X;
  }

  const outNodes: ActivityNodeGeo[] = [
    forkBarGeo,
    ...allBranchNodes,
    joinBarGeo,
  ];

  return {
    nodes: outNodes,
    edges: outEdges,
    bottomY: joinBarY + BAR_HEIGHT,
    width: barWidth,
    firstId: forkBarId,
    lastId: joinBarId,
  };
}

// ---------------------------------------------------------------------------
// While layout
// ---------------------------------------------------------------------------

function layoutWhile(
  node: ActivityWhile,
  startY: number,
  centerX: number,
  ctx: LayoutCtx,
): BranchResult {
  const headerId = nextId(ctx, 'while-header');
  const headerGeo: ActivityNodeGeo = {
    id: headerId,
    kind: 'while-header',
    label: node.condition,
    x: centerX - DIAMOND_SIZE / 2,
    y: startY,
    width: DIAMOND_SIZE,
    height: DIAMOND_SIZE,
  };

  const headerBottomY = startY + DIAMOND_SIZE;
  const bodyStartY = headerBottomY + NODE_MARGIN_Y;

  const bodyResult = layoutSequence(node.body, bodyStartY, centerX, ctx);

  const outEdges: ActivityEdgeGeo[] = [...bodyResult.edges];

  // Header → body start
  if (bodyResult.firstId !== undefined) {
    const firstNode = bodyResult.nodes.find((n) => n.id === bodyResult.firstId);
    if (firstNode !== undefined) {
      outEdges.push({
        points: [
          { x: centerX, y: headerBottomY },
          { x: firstNode.x + firstNode.width / 2, y: firstNode.y },
        ],
        label: node.condition,
      });
    }
  }

  // Body end → header (back edge)
  if (bodyResult.lastId !== undefined) {
    const lastNode = bodyResult.nodes.find((n) => n.id === bodyResult.lastId);
    if (lastNode !== undefined) {
      outEdges.push({
        points: [
          { x: lastNode.x + lastNode.width / 2, y: lastNode.y + lastNode.height },
          { x: centerX, y: startY },
        ],
      });
    }
  }

  const bottomY = bodyResult.bottomY;
  const outNodes: ActivityNodeGeo[] = [headerGeo, ...bodyResult.nodes];

  return {
    nodes: outNodes,
    edges: outEdges,
    bottomY,
    width: bodyResult.width,
    firstId: headerId,
    lastId: bodyResult.lastId ?? headerId,
  };
}

// ---------------------------------------------------------------------------
// Repeat layout
// ---------------------------------------------------------------------------

function layoutRepeat(
  node: ActivityRepeat,
  startY: number,
  centerX: number,
  ctx: LayoutCtx,
): BranchResult {
  const repeatStartId = nextId(ctx, 'repeat-start');
  const repeatStartGeo: ActivityNodeGeo = {
    id: repeatStartId,
    kind: 'repeat-start',
    x: centerX - DIAMOND_SIZE / 2,
    y: startY,
    width: DIAMOND_SIZE,
    height: DIAMOND_SIZE,
  };

  const bodyStartY = startY + DIAMOND_SIZE + NODE_MARGIN_Y;
  const bodyResult = layoutSequence(node.body, bodyStartY, centerX, ctx);

  // Condition check diamond below body
  const condY = bodyResult.bottomY + NODE_MARGIN_Y;
  const condId = nextId(ctx, 'while-header');
  const condGeo: ActivityNodeGeo = {
    id: condId,
    kind: 'while-header',
    label: node.condition,
    x: centerX - DIAMOND_SIZE / 2,
    y: condY,
    width: DIAMOND_SIZE,
    height: DIAMOND_SIZE,
  };

  const outEdges: ActivityEdgeGeo[] = [...bodyResult.edges];

  // repeat-start → body first
  if (bodyResult.firstId !== undefined) {
    const firstNode = bodyResult.nodes.find((n) => n.id === bodyResult.firstId);
    if (firstNode !== undefined) {
      outEdges.push({
        points: [
          { x: centerX, y: startY + DIAMOND_SIZE },
          { x: firstNode.x + firstNode.width / 2, y: firstNode.y },
        ],
      });
    }
  }

  // body last → condition
  if (bodyResult.lastId !== undefined) {
    const lastNode = bodyResult.nodes.find((n) => n.id === bodyResult.lastId);
    if (lastNode !== undefined) {
      outEdges.push({
        points: [
          { x: lastNode.x + lastNode.width / 2, y: lastNode.y + lastNode.height },
          { x: centerX, y: condY },
        ],
      });
    }
  }

  // condition back edge → repeat-start
  outEdges.push({
    points: [
      { x: centerX, y: condY },
      { x: centerX, y: startY },
    ],
    label: node.condition,
  });

  const outNodes: ActivityNodeGeo[] = [
    repeatStartGeo,
    ...bodyResult.nodes,
    condGeo,
  ];

  return {
    nodes: outNodes,
    edges: outEdges,
    bottomY: condY + DIAMOND_SIZE,
    width: bodyResult.width,
    firstId: repeatStartId,
    lastId: condId,
  };
}

// ---------------------------------------------------------------------------
// Swimlane setup
// ---------------------------------------------------------------------------

function buildSwimlaneCtx(
  swimlanes: readonly string[],
  base: Omit<LayoutCtx, 'laneX' | 'laneWidth' | 'canvasWidth'>,
): LayoutCtx {
  if (swimlanes.length === 0) {
    return {
      ...base,
      laneX: new Map(),
      laneWidth: 0,
      canvasWidth: DEFAULT_WIDTH,
    };
  }

  const laneWidth = Math.max(
    SWIMLANE_MIN_WIDTH,
    ACTION_MIN_WIDTH + ACTION_H_PAD * 2,
  );
  const laneX = new Map<string, number>();
  for (let i = 0; i < swimlanes.length; i++) {
    laneX.set(swimlanes[i]!, i * laneWidth);
  }

  return {
    ...base,
    laneX,
    laneWidth,
    canvasWidth: swimlanes.length * laneWidth,
  };
}

function buildSwimlaneGeos(
  swimlanes: readonly string[],
  ctx: LayoutCtx,
): SwimlaneGeo[] {
  if (swimlanes.length === 0) return [];
  return swimlanes.map((name) => ({
    name,
    x: ctx.laneX.get(name) ?? 0,
    width: ctx.laneWidth,
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function layoutActivity(
  ast: ActivityDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): ActivityGeometry {
  if (ast.nodes.length === 0) {
    return {
      totalWidth: 0,
      totalHeight: 0,
      nodes: [],
      edges: [],
      swimlanes: [],
    };
  }

  const baseCtx = {
    theme,
    measurer,
    counters: new Map<string, number>(),
  };

  const ctx = buildSwimlaneCtx(ast.swimlanes, baseCtx);

  const hasSwimlanes = ast.swimlanes.length > 0;
  const startY = LAYOUT_MARGIN + (hasSwimlanes ? SWIMLANE_HEADER_H : 0);
  const centerX = ctx.canvasWidth / 2;

  const result = layoutSequence(ast.nodes, startY, centerX, ctx);

  const swimlaneGeos = buildSwimlaneGeos(ast.swimlanes, ctx);

  // Compute total bounds from all nodes
  let maxRight = ctx.canvasWidth;
  let maxBottom = 0;
  for (const n of result.nodes) {
    if (n.x + n.width > maxRight) maxRight = n.x + n.width;
    if (n.y + n.height > maxBottom) maxBottom = n.y + n.height;
  }
  maxBottom += LAYOUT_MARGIN;
  maxRight += LAYOUT_MARGIN;

  return {
    totalWidth: maxRight,
    totalHeight: maxBottom,
    nodes: result.nodes,
    edges: result.edges,
    swimlanes: swimlaneGeos,
  };
}
