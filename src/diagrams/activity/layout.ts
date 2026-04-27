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
  ActivityArrowLabel,
  ActivityIf,
  ActivityFork,
  ActivitySplit,
  ActivityWhile,
  ActivityRepeat,
  ActivityBreak,
} from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { FontSpec, StringMeasurer } from '../../core/measurer.js';
import { measureNodeLabel } from '../../core/latex.js';

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
  color?: string;
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

const DIAMOND_MIN = 20;
const DIAMOND_LABEL_PAD = 10;

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

/**
 * Compute the half-size of a decision diamond to fit its label text.
 * A rotated square with half-size s can contain text W×H when W/2 + H/2 ≤ s.
 */
function diamondSize(label: string, ctx: LayoutCtx): number {
  if (label === '') return DIAMOND_MIN;
  const font: FontSpec = { family: ctx.theme.fontFamily, size: ctx.theme.fontSize - 2 };
  const m = ctx.measurer.measure(label, font);
  return Math.max(DIAMOND_MIN, Math.round((m.width + m.height) / 2) + DIAMOND_LABEL_PAD);
}

function actionSize(
  label: string,
  ctx: LayoutCtx,
): { width: number; height: number } {
  const font: FontSpec = { family: ctx.theme.fontFamily, size: ctx.theme.fontSize };
  const measured = measureNodeLabel(label, ctx.measurer, font);
  const isLatex = label.includes('<latex>');
  return {
    width: Math.max(ACTION_MIN_WIDTH, isLatex ? measured.width : measured.width + ACTION_H_PAD * 2),
    height: Math.max(ACTION_HEIGHT, measured.height),
  };
}

/**
 * Builds orthogonal (right-angle) waypoints from (fromX, fromY) to (toX, toY).
 * If the x positions match, returns a direct vertical line.
 * Otherwise returns a Z-shaped path: down to midY, horizontal, down to target.
 */
function orthogonalPoints(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Array<{ x: number; y: number }> {
  if (Math.abs(fromX - toX) < 1) {
    return [
      { x: fromX, y: fromY },
      { x: toX, y: toY },
    ];
  }
  const midY = Math.round((fromY + toY) / 2);
  return [
    { x: fromX, y: fromY },
    { x: fromX, y: midY },
    { x: toX, y: midY },
    { x: toX, y: toY },
  ];
}

/**
 * Returns the x-center for a node given swimlane context.
 * When swimlanes are active and the node has a lane, uses that lane's center.
 * Otherwise uses the provided fallback center (branch-specific center).
 */
function nodeCenterX(
  swimlane: string | undefined,
  fallbackCenterX: number,
  ctx: LayoutCtx,
): number {
  if (swimlane !== undefined && ctx.laneX.size > 0) {
    const lx = ctx.laneX.get(swimlane);
    if (lx !== undefined) {
      return lx + ctx.laneWidth / 2;
    }
  }
  return fallbackCenterX;
}

// ---------------------------------------------------------------------------
// Subtree width measurement
// ---------------------------------------------------------------------------

/**
 * Recursively measure the column width required for a single node.
 * For composite nodes (if/fork/split), this is the sum of all branch widths.
 * For leaf nodes, this is the rendered node width.
 */
function measureNodeWidth(node: ActivityNode, ctx: LayoutCtx): number {
  switch (node.kind) {
    case 'action':
      return actionSize(node.label, ctx).width;
    case 'note':
      return actionSize(node.text, ctx).width;
    case 'if': {
      const branchWidths = [
        measureSubtreeWidth(node.thenBranch, ctx),
        ...node.elseIfBranches.map((eif) => measureSubtreeWidth(eif.body, ctx)),
        measureSubtreeWidth(node.elseBranch, ctx),
      ];
      const n = branchWidths.length;
      return (
        branchWidths.reduce((sum, w) => sum + w, 0) + NODE_MARGIN_X * (n - 1)
      );
    }
    case 'fork': {
      const n = node.branches.length;
      const total = node.branches.reduce(
        (sum, b) => sum + measureSubtreeWidth(b, ctx),
        0,
      );
      return total + NODE_MARGIN_X * Math.max(n - 1, 0);
    }
    case 'split': {
      const n = node.branches.length;
      const total = node.branches.reduce(
        (sum, b) => sum + measureSubtreeWidth(b, ctx),
        0,
      );
      return total + NODE_MARGIN_X * Math.max(n - 1, 0);
    }
    case 'while':
      return measureSubtreeWidth(node.body, ctx);
    case 'repeat':
      return measureSubtreeWidth(node.body, ctx);
    default:
      return ACTION_MIN_WIDTH + ACTION_H_PAD * 2;
  }
}

/**
 * Returns the minimum column width needed to lay out the given sequence of
 * nodes vertically. This is the MAX width of any individual node in the
 * sequence (since nodes stack vertically and share the same column).
 */
function measureSubtreeWidth(
  nodes: readonly ActivityNode[],
  ctx: LayoutCtx,
): number {
  const min = ACTION_MIN_WIDTH + ACTION_H_PAD * 2;
  if (nodes.length === 0) return min;
  return Math.max(min, ...nodes.map((n) => measureNodeWidth(n, ctx)));
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
  /** Id of last node in branch (for edge connections). undefined when node has multiple exits. */
  lastId: string | undefined;
  /**
   * When a composite node (if) has multiple open exits (non-terminal branches),
   * all their IDs are listed here. The caller uses these to fan-in to the next node.
   * Only present when exitIds.length > 1.
   */
  exitIds?: string[];
  /**
   * Geo nodes emitted by `break` statements inside this branch.
   * layoutRepeat drains these and wires them to the break-exit diamond.
   */
  breakGeos?: ActivityNodeGeo[];
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
  /** exitIds carried from the previous node (multiple-exit nodes like if). */
  let lastExitIds: string[] | undefined;
  /** Accumulated break geos from child nodes. */
  const accBreakGeos: ActivityNodeGeo[] = [];
  /** Pending label/color to attach to the next edge created. */
  let pendingLabel: { label: string; color?: string } | undefined;

  for (const node of nodes) {
    // arrow-label is a flow annotation, not a layout node.
    // Capture it as pending style for the next edge and skip layout.
    if (node.kind === 'arrow-label') {
      pendingLabel = { label: node.label, ...(node.color !== undefined ? { color: node.color } : {}) };
      continue;
    }

    const result = layoutNode(node, currentY, centerX, ctx);
    outNodes.push(...result.nodes);
    outEdges.push(...result.edges);

    // Accumulate breakGeos from child results
    if (result.breakGeos !== undefined && result.breakGeos.length > 0) {
      accBreakGeos.push(...result.breakGeos);
    }

    // Connect previous exit(s) to this node's first
    if (result.firstId !== undefined) {
      const toNode = outNodes.find((n) => n.id === result.firstId);
      if (toNode !== undefined) {
        const prevExits =
          lastExitIds !== undefined
            ? lastExitIds
            : lastId !== undefined
              ? [lastId]
              : [];
        for (const exitId of prevExits) {
          const fromNode = outNodes.find((n) => n.id === exitId);
          if (fromNode !== undefined) {
            // Build edge, consuming any pending label.
            const edgeProps: ActivityEdgeGeo = {
              points: orthogonalPoints(
                fromNode.x + fromNode.width / 2,
                fromNode.y + fromNode.height,
                toNode.x + toNode.width / 2,
                toNode.y,
              ),
            };
            if (pendingLabel !== undefined) {
              edgeProps.label = pendingLabel.label;
              if (pendingLabel.color !== undefined) {
                edgeProps.color = pendingLabel.color;
              }
              pendingLabel = undefined;
            }
            outEdges.push(edgeProps);
          }
        }
      }
    }

    if (firstId === undefined) {
      firstId = result.firstId;
    }
    // When a break node returns lastId === undefined, stop advancing lastId
    // so subsequent nodes in the sequence are not connected to the break.
    if (result.lastId !== undefined) {
      lastId = result.lastId;
      lastExitIds = result.exitIds;
    } else if (result.kind === 'break-stop') {
      // Break node: lastId stays as the break node id so nothing connects
      // after it. We deliberately do not update lastId here — the break geo
      // has no outgoing flow edge.
      lastId = undefined;
      lastExitIds = undefined;
    }
    currentY = result.bottomY + NODE_MARGIN_Y;
  }

  const bottomY = currentY > startY ? currentY - NODE_MARGIN_Y : startY;

  let maxRight = 0;
  let minLeft = Infinity;
  for (const n of outNodes) {
    if (n.x < minLeft) minLeft = n.x;
    if (n.x + n.width > maxRight) maxRight = n.x + n.width;
  }
  const width = outNodes.length > 0 ? maxRight - minLeft : 0;

  // Propagate exitIds if the last node had multiple open exits
  const resultExitIds =
    lastExitIds !== undefined && lastExitIds.length > 1
      ? lastExitIds
      : undefined;

  return {
    nodes: outNodes,
    edges: outEdges,
    bottomY,
    width,
    firstId,
    lastId,
    ...(resultExitIds !== undefined ? { exitIds: resultExitIds } : {}),
    ...(accBreakGeos.length > 0 ? { breakGeos: accBreakGeos } : {}),
  };
}

/**
 * Extended BranchResult used internally to signal break-stop to layoutSequence.
 * The `kind` field is not part of the public BranchResult interface.
 */
type BranchResultInternal = BranchResult & { kind?: 'break-stop' };

/**
 * Lay out a single ActivityNode at the given position.
 * Returns the placed node(s), generated edges, the bottom y, and
 * the first/last node ids for edge connection purposes.
 *
 * Note: 'arrow-label' nodes are handled by layoutSequence before reaching
 * this function. The case here is a defensive no-op for type exhaustiveness.
 */
function layoutNode(
  node: ActivityNode,
  startY: number,
  centerX: number,
  ctx: LayoutCtx,
): BranchResultInternal {
  switch (node.kind) {
    case 'start':
      return layoutStart(node.swimlane, startY, centerX, ctx);

    case 'stop':
    case 'end':
    case 'kill':
      return layoutStop(node.kind, node.swimlane, startY, centerX, ctx);

    case 'detach': {
      return layoutStop('stop', node.swimlane, startY, centerX, ctx);
    }

    case 'action':
      return layoutAction(node.label, node.color, node.swimlane, startY, centerX, ctx);

    case 'break':
      return layoutBreak(node, startY, centerX, ctx);

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

    case 'arrow-label': {
      // Defensive: arrow-label is handled in layoutSequence before reaching here.
      // Return an empty result to satisfy type exhaustiveness.
      return {
        nodes: [],
        edges: [],
        bottomY: startY,
        width: 0,
        firstId: undefined,
        lastId: undefined,
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
  centerX: number,
  ctx: LayoutCtx,
): BranchResult {
  const cx = nodeCenterX(swimlane, centerX, ctx);
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
  centerX: number,
  ctx: LayoutCtx,
): BranchResult {
  const cx = nodeCenterX(swimlane, centerX, ctx);
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
  centerX: number,
  ctx: LayoutCtx,
): BranchResult {
  const cx = nodeCenterX(swimlane, centerX, ctx);
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

function layoutBreak(
  node: ActivityBreak,
  startY: number,
  centerX: number,
  ctx: LayoutCtx,
): BranchResultInternal {
  const cx = nodeCenterX(node.swimlane, centerX, ctx);
  const id = nextId(ctx, 'break');
  const size = DIAMOND_MIN;
  const geo: ActivityNodeGeo = {
    id,
    kind: 'break',
    x: cx - size / 2,
    y: startY,
    width: size,
    height: size,
  };
  return {
    nodes: [geo],
    edges: [],
    bottomY: startY + size,
    width: size,
    firstId: id,
    // lastId is undefined: no outgoing flow edge from the break node
    lastId: undefined,
    breakGeos: [geo],
    // Signal to layoutSequence that this is a break-stop, not a regular node
    kind: 'break-stop',
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

  // Build branch list: [then, ...elseIfs, else]
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

  // Measure each branch column width using recursive subtree measurement
  const colWidths = allBranches.map((b) => measureSubtreeWidth(b.nodes, ctx));
  const totalBranchWidth =
    colWidths.reduce((s, w) => s + w, 0) + NODE_MARGIN_X * (branchCount - 1);

  // Place the decision diamond centered at this block's centerX
  const dSplit = diamondSize(node.condition, ctx);
  const splitGeo: ActivityNodeGeo = {
    id: splitId,
    kind: 'if-split',
    label: node.condition,
    x: centerX - dSplit / 2,
    y: startY,
    width: dSplit,
    height: dSplit,
  };

  const splitBottomY = startY + dSplit;
  const branchStartY = splitBottomY + NODE_MARGIN_Y;

  // Place each branch in its own column side-by-side
  let colLeft = centerX - totalBranchWidth / 2;
  let maxBranchBottom = branchStartY;

  const allBranchNodes: ActivityNodeGeo[] = [];
  const allBranchEdges: ActivityEdgeGeo[] = [];
  const branchFirstIds: (string | undefined)[] = [];
  const branchLastIds: (string | undefined)[] = [];
  const branchSubExitIds: (string[] | undefined)[] = [];
  const allBreakGeos: ActivityNodeGeo[] = [];

  for (let i = 0; i < allBranches.length; i++) {
    const colWidth = colWidths[i]!;
    const colCenterX = colLeft + colWidth / 2;
    const branch = allBranches[i]!;

    const result = layoutSequence(branch.nodes, branchStartY, colCenterX, ctx);
    branchFirstIds.push(result.firstId);
    branchLastIds.push(result.lastId);
    branchSubExitIds.push(result.exitIds);

    allBranchNodes.push(...result.nodes);
    allBranchEdges.push(...result.edges);

    // Propagate breakGeos from branches upward
    if (result.breakGeos !== undefined && result.breakGeos.length > 0) {
      allBreakGeos.push(...result.breakGeos);
    }

    if (result.bottomY > maxBranchBottom) {
      maxBranchBottom = result.bottomY;
    }

    colLeft += colWidth + NODE_MARGIN_X;
  }

  const outEdges: ActivityEdgeGeo[] = [...allBranchEdges];

  // Edges: split diamond → each branch start
  colLeft = centerX - totalBranchWidth / 2;
  for (let i = 0; i < allBranches.length; i++) {
    const colWidth = colWidths[i]!;
    const colCenterX = colLeft + colWidth / 2;
    const firstId = branchFirstIds[i];
    const branch = allBranches[i]!;

    const edgeGeo: ActivityEdgeGeo = { points: [] };
    if (firstId !== undefined) {
      const firstNode = allBranchNodes.find((n) => n.id === firstId);
      const targetX =
        firstNode !== undefined
          ? firstNode.x + firstNode.width / 2
          : colCenterX;
      const targetY =
        firstNode !== undefined ? firstNode.y : branchStartY;
      // Horizontal at diamond level, then straight down to branch first node
      edgeGeo.points =
        Math.abs(targetX - centerX) < 1
          ? [{ x: centerX, y: splitBottomY }, { x: targetX, y: targetY }]
          : [
              { x: centerX, y: splitBottomY },
              { x: targetX, y: splitBottomY },
              { x: targetX, y: targetY },
            ];
    } else {
      // Empty branch stub
      edgeGeo.points = [
        { x: centerX, y: splitBottomY },
        { x: colCenterX, y: splitBottomY },
        { x: colCenterX, y: branchStartY },
      ];
    }
    if (branch.label !== undefined) {
      edgeGeo.label = branch.label;
    }
    if (edgeGeo.points.length >= 2) outEdges.push(edgeGeo);

    colLeft += colWidth + NODE_MARGIN_X;
  }

  // Collect open exit IDs from all branches (skip terminal nodes stop/end/kill)
  const exitIds: string[] = [];
  for (let i = 0; i < allBranches.length; i++) {
    const subExits = branchSubExitIds[i];
    if (subExits !== undefined && subExits.length > 0) {
      exitIds.push(...subExits);
    } else {
      const lastId = branchLastIds[i];
      if (lastId !== undefined) {
        const lastNode = allBranchNodes.find((n) => n.id === lastId);
        if (
          lastNode !== undefined &&
          !['stop', 'end', 'kill'].includes(lastNode.kind)
        ) {
          exitIds.push(lastId);
        }
      }
    }
  }

  // If there's exactly one open exit, expose it as lastId for simple chaining
  const singleLastId = exitIds.length === 1 ? exitIds[0] : undefined;

  return {
    nodes: [splitGeo, ...allBranchNodes],
    edges: outEdges,
    bottomY: maxBranchBottom,
    width: totalBranchWidth,
    firstId: splitId,
    lastId: singleLastId,
    ...(exitIds.length > 1 ? { exitIds } : {}),
    ...(allBreakGeos.length > 0 ? { breakGeos: allBreakGeos } : {}),
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

  // Measure each branch column width
  const colWidths = branches.map((b) => measureSubtreeWidth(b, ctx));
  const totalBranchWidth =
    colWidths.reduce((s, w) => s + w, 0) +
    NODE_MARGIN_X * Math.max(branchCount - 1, 0);

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
          points: orthogonalPoints(
            colCenterX,
            forkBarBottomY,
            firstNode.x + firstNode.width / 2,
            firstNode.y,
          ),
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
          points: orthogonalPoints(
            lastNode.x + lastNode.width / 2,
            lastNode.y + lastNode.height,
            colCenterX,
            joinBarY,
          ),
        });
      }
    }

    colLeft += colWidth + NODE_MARGIN_X;
  }

  return {
    nodes: [forkBarGeo, ...allBranchNodes, joinBarGeo],
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
  const dHeader = diamondSize(node.condition, ctx);
  const headerGeo: ActivityNodeGeo = {
    id: headerId,
    kind: 'while-header',
    label: node.condition,
    x: centerX - dHeader / 2,
    y: startY,
    width: dHeader,
    height: dHeader,
  };

  const headerBottomY = startY + dHeader;
  const bodyStartY = headerBottomY + NODE_MARGIN_Y;

  const bodyResult = layoutSequence(node.body, bodyStartY, centerX, ctx);

  const outEdges: ActivityEdgeGeo[] = [...bodyResult.edges];

  // Header → body start
  if (bodyResult.firstId !== undefined) {
    const firstNode = bodyResult.nodes.find((n) => n.id === bodyResult.firstId);
    if (firstNode !== undefined) {
      outEdges.push({
        points: orthogonalPoints(
          centerX,
          headerBottomY,
          firstNode.x + firstNode.width / 2,
          firstNode.y,
        ),
        label: node.condition,
      });
    }
  }

  // Body end → header (back edge)
  if (bodyResult.lastId !== undefined) {
    const lastNode = bodyResult.nodes.find((n) => n.id === bodyResult.lastId);
    if (lastNode !== undefined) {
      outEdges.push({
        points: orthogonalPoints(
          lastNode.x + lastNode.width / 2,
          lastNode.y + lastNode.height,
          centerX,
          startY,
        ),
      });
    }
  }

  return {
    nodes: [headerGeo, ...bodyResult.nodes],
    edges: outEdges,
    bottomY: bodyResult.bottomY,
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
  const dStart = DIAMOND_MIN;
  const repeatStartGeo: ActivityNodeGeo = {
    id: repeatStartId,
    kind: 'repeat-start',
    x: centerX - dStart / 2,
    y: startY,
    width: dStart,
    height: dStart,
  };

  const bodyStartY = startY + dStart + NODE_MARGIN_Y;
  const bodyResult = layoutSequence(node.body, bodyStartY, centerX, ctx);

  // Condition check diamond below body
  const condY = bodyResult.bottomY + NODE_MARGIN_Y;
  const condId = nextId(ctx, 'while-header');
  const dCond = diamondSize(node.condition, ctx);
  const condGeo: ActivityNodeGeo = {
    id: condId,
    kind: 'while-header',
    label: node.condition,
    x: centerX - dCond / 2,
    y: condY,
    width: dCond,
    height: dCond,
  };

  const outEdges: ActivityEdgeGeo[] = [...bodyResult.edges];

  // repeat-start → body first
  if (bodyResult.firstId !== undefined) {
    const firstNode = bodyResult.nodes.find((n) => n.id === bodyResult.firstId);
    if (firstNode !== undefined) {
      outEdges.push({
        points: orthogonalPoints(
          centerX,
          startY + dStart,
          firstNode.x + firstNode.width / 2,
          firstNode.y,
        ),
      });
    }
  }

  // body last → condition
  if (bodyResult.lastId !== undefined) {
    const lastNode = bodyResult.nodes.find((n) => n.id === bodyResult.lastId);
    if (lastNode !== undefined) {
      outEdges.push({
        points: orthogonalPoints(
          lastNode.x + lastNode.width / 2,
          lastNode.y + lastNode.height,
          centerX,
          condY,
        ),
      });
    }
  }

  // condition back edge → repeat-start: routes around the left side of the body
  // so the arrow doesn't cross through the body nodes.
  const leftX = centerX - bodyResult.width / 2 - NODE_MARGIN_X;
  outEdges.push({
    points: [
      { x: centerX - dCond / 2, y: condY + dCond / 2 },
      { x: leftX, y: condY + dCond / 2 },
      { x: leftX, y: startY + dStart / 2 },
      { x: centerX - dStart / 2, y: startY + dStart / 2 },
    ],
  });

  // Handle break geos: drain them and create a break-exit diamond
  const breakGeos = bodyResult.breakGeos;
  if (breakGeos !== undefined && breakGeos.length > 0) {
    // Position break-exit diamond below the condition diamond
    const breakExitY = condY + dCond + NODE_MARGIN_Y;
    const breakExitId = nextId(ctx, 'while-header');
    const breakExitGeo: ActivityNodeGeo = {
      id: breakExitId,
      kind: 'while-header',
      x: centerX - DIAMOND_MIN / 2,
      y: breakExitY,
      width: DIAMOND_MIN,
      height: DIAMOND_MIN,
    };

    // Wire each break geo → break-exit diamond
    for (const breakGeo of breakGeos) {
      outEdges.push({
        points: orthogonalPoints(
          breakGeo.x + breakGeo.width / 2,
          breakGeo.y + breakGeo.height,
          centerX,
          breakExitY,
        ),
      });
    }

    return {
      nodes: [repeatStartGeo, ...bodyResult.nodes, condGeo, breakExitGeo],
      edges: outEdges,
      bottomY: breakExitY + DIAMOND_MIN,
      width: bodyResult.width,
      firstId: repeatStartId,
      // Expose the break-exit diamond as lastId so layoutSequence wires
      // the post-repeat node to it
      lastId: breakExitId,
    };
  }

  return {
    nodes: [repeatStartGeo, ...bodyResult.nodes, condGeo],
    edges: outEdges,
    bottomY: condY + dCond,
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

  const hasSwimlanes = ast.swimlanes.length > 0;
  const startY = LAYOUT_MARGIN + (hasSwimlanes ? SWIMLANE_HEADER_H : 0);

  let ctx: LayoutCtx;

  if (hasSwimlanes) {
    ctx = buildSwimlaneCtx(ast.swimlanes, baseCtx);
  } else {
    // Pre-measure total content width so canvas fits the diagram
    const tempCtx: LayoutCtx = {
      ...baseCtx,
      laneX: new Map(),
      laneWidth: 0,
      canvasWidth: DEFAULT_WIDTH,
    };
    const rootWidth = measureSubtreeWidth(ast.nodes, tempCtx);
    const canvasWidth = Math.max(
      rootWidth + LAYOUT_MARGIN * 2,
      ACTION_MIN_WIDTH + ACTION_H_PAD * 2 + LAYOUT_MARGIN * 2,
    );
    ctx = {
      ...baseCtx,
      laneX: new Map(),
      laneWidth: 0,
      canvasWidth,
    };
  }

  const centerX = ctx.canvasWidth / 2;
  const result = layoutSequence(ast.nodes, startY, centerX, ctx);
  const swimlaneGeos = buildSwimlaneGeos(ast.swimlanes, ctx);

  // Compute total bounds from actual placed nodes
  let maxRight = 0;
  let maxBottom = 0;
  for (const n of result.nodes) {
    if (n.x + n.width > maxRight) maxRight = n.x + n.width;
    if (n.y + n.height > maxBottom) maxBottom = n.y + n.height;
  }
  maxBottom += LAYOUT_MARGIN;
  maxRight = Math.max(maxRight + LAYOUT_MARGIN, ctx.canvasWidth);

  return {
    totalWidth: maxRight,
    totalHeight: maxBottom,
    nodes: result.nodes,
    edges: result.edges,
    swimlanes: swimlaneGeos,
  };
}

// Re-export ActivityArrowLabel so consumers can use it without importing ast.ts directly.
export type { ActivityArrowLabel };
