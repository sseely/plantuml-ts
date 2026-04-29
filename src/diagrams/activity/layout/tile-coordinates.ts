import type { ActivityDiagramAST } from '../ast.js';
import type {
  ActivityEdgeGeo,
  ActivityGeometry,
  ActivityNodeGeo,
  SwimlaneGeo,
} from '../layout.old.js';
import type { Tile } from '../tiles/tile.js';
import { NORTH_HOOK, SOUTH_HOOK } from '../tiles/points.js';
import type { StringBounder } from '../tiles/tile.js';
import type { Theme } from '../../../core/theme.js';
import type { GtileAction } from '../tiles/gtile-action.js';
import type { GtileNote } from '../tiles/gtile-note.js';
import type { GtileDiamond } from '../tiles/gtile-diamond.js';
import type { GtileTopDown } from '../tiles/gtile-top-down.js';
import type { GtileIf } from '../tiles/gtile-if.js';
import type { GtileWhile } from '../tiles/gtile-while.js';
import type { GtileRepeat } from '../tiles/gtile-repeat.js';
import type { GtileFork } from '../tiles/gtile-fork.js';
import type { GtileGroup } from '../tiles/gtile-group.js';
import type { GtileSwitch } from '../tiles/gtile-switch.js';
import type { GtileLabel } from '../tiles/gtile-label.js';
import { GConnectionVerticalDown } from '../routing/gconnection-vertical-down.js';
import { GConnectionVerticalDownThenBack } from '../routing/gconnection-vertical-down-then-back.js';
import { GConnectionDownThenUp } from '../routing/gconnection-down-then-up.js';
import { GConnectionSideThenVerticalThenSide } from '../routing/gconnection-side-then-vertical-then-side.js';
import { buildSwimlaneContexts } from './swimlane-context.js';

export const LAYOUT_MARGIN = 12;
const SWIMLANE_MIN_WIDTH = 120;
const BAR_HEIGHT = 8;

interface Out {
  nodes: ActivityNodeGeo[];
  edges: ActivityEdgeGeo[];
  nextId: (prefix: string) => string;
}

function walkTile(
  tile: Tile,
  x: number,
  y: number,
  kindHint: string | null,
  out: Out,
): void {
  switch (tile.kind) {
    case 'gtile-start':
      out.nodes.push({ id: out.nextId('start'), kind: 'start', x, y, width: tile.width, height: tile.height });
      return;

    case 'gtile-stop':
      out.nodes.push({ id: out.nextId('stop'), kind: 'stop', x, y, width: tile.width, height: tile.height });
      return;

    case 'gtile-end':
      out.nodes.push({ id: out.nextId('end'), kind: 'end', x, y, width: tile.width, height: tile.height });
      return;

    case 'gtile-kill':
      out.nodes.push({ id: out.nextId('kill'), kind: 'kill', x, y, width: tile.width, height: tile.height });
      return;

    case 'gtile-break':
      out.nodes.push({ id: out.nextId('break'), kind: 'break', x, y, width: tile.width, height: tile.height });
      return;

    case 'gtile-action': {
      const t = tile as unknown as GtileAction;
      const node: ActivityNodeGeo = { id: out.nextId('action'), kind: 'action', x, y, width: t.width, height: t.height, label: t.label };
      if (t.color !== undefined) node.color = t.color;
      out.nodes.push(node);
      return;
    }

    case 'gtile-note': {
      const t = tile as unknown as GtileNote;
      out.nodes.push({ id: out.nextId('note'), kind: 'note', x, y, width: t.width, height: t.height, label: t.text, notePosition: t.side });
      return;
    }

    case 'gtile-diamond': {
      const t = tile as unknown as GtileDiamond;
      const k = kindHint !== null && !kindHint.startsWith('gtile-') ? kindHint : 'diamond';
      out.nodes.push({ id: out.nextId(k), kind: k, x, y, width: t.width, height: t.height, label: t.label });
      return;
    }

    case 'gtile-spot':
      out.nodes.push({ id: out.nextId('spot'), kind: 'spot', x, y, width: tile.width, height: tile.height });
      return;

    case 'gtile-label': {
      const t = tile as unknown as GtileLabel;
      out.nodes.push({ id: out.nextId('label'), kind: 'label', x, y, width: t.width, height: t.height, label: t.name });
      return;
    }

    case 'gtile-top-down': {
      const t = tile as unknown as GtileTopDown;
      if (t.children.length === 0) return;
      const centerX = x + tile.width / 2;
      for (let i = 0; i < t.children.length; i++) {
        const child = t.children[i]!;
        const childY = y + t.childOffsets[i]!;
        const childX = centerX - child.width / 2;
        walkTile(child, childX, childY, null, out);
        if (i < t.children.length - 1) {
          const next = t.children[i + 1]!;
          const nextY = y + t.childOffsets[i + 1]!;
          const nextX = centerX - next.width / 2;
          const from = { x: childX + child.getCoord(SOUTH_HOOK).x, y: childY + child.getCoord(SOUTH_HOOK).y };
          const to = { x: nextX + next.getCoord(NORTH_HOOK).x, y: nextY + next.getCoord(NORTH_HOOK).y };
          out.edges.push({ points: new GConnectionVerticalDown().getPoints(from, to) });
        }
      }
      return;
    }

    case 'gtile-if': {
      const t = tile as unknown as GtileIf;
      const centerX = x + tile.width / 2;
      const hasMerge = t.mergeOffsetY !== null;
      const rawChildren = t.children;
      const diamond = rawChildren[0]!;
      const branches = hasMerge ? rawChildren.slice(1, -1) : rawChildren.slice(1);
      const mergeDiamond = hasMerge ? rawChildren[rawChildren.length - 1]! : null;

      const dX = centerX - diamond.width / 2;
      const dY = y + t.diamondOffsetY;
      walkTile(diamond, dX, dY, 'if-split', out);

      for (let i = 0; i < branches.length; i++) {
        const branch = branches[i]!;
        const bX = x + t.branchOffsets[i]!;
        const bY = y + t.branchOffsetY;
        walkTile(branch, bX, bY, null, out);

        const from = { x: dX + diamond.getCoord(SOUTH_HOOK).x, y: dY + diamond.getCoord(SOUTH_HOOK).y };
        const to = { x: bX + branch.getCoord(NORTH_HOOK).x, y: bY + branch.getCoord(NORTH_HOOK).y };
        out.edges.push({ points: new GConnectionSideThenVerticalThenSide().getPoints(from, to) });

        if (mergeDiamond !== null) {
          const mX = centerX - mergeDiamond.width / 2;
          const mY = y + t.mergeOffsetY!;
          const mFrom = { x: bX + branch.getCoord(SOUTH_HOOK).x, y: bY + branch.getCoord(SOUTH_HOOK).y };
          const mTo = { x: mX + mergeDiamond.getCoord(NORTH_HOOK).x, y: mY + mergeDiamond.getCoord(NORTH_HOOK).y };
          out.edges.push({ points: new GConnectionSideThenVerticalThenSide().getPoints(mFrom, mTo) });
        }
      }

      if (mergeDiamond !== null) {
        const mX = centerX - mergeDiamond.width / 2;
        const mY = y + t.mergeOffsetY!;
        walkTile(mergeDiamond, mX, mY, 'if-merge', out);
      }
      return;
    }

    case 'gtile-while': {
      const t = tile as unknown as GtileWhile;
      const rawChildren = t.children;
      const header = rawChildren[0]!;
      const body = rawChildren[1]!;
      // Center of content area (excludes the back-edge lane)
      const contentCenterX = x + t.getCoord(NORTH_HOOK).x;

      const hX = contentCenterX - header.width / 2;
      const hY = y + t.headerOffsetY;
      walkTile(header, hX, hY, 'while-header', out);

      const bX = contentCenterX - body.width / 2;
      const bY = y + t.bodyOffsetY;
      walkTile(body, bX, bY, null, out);

      // Forward: header south → body north
      const fFrom = { x: hX + header.getCoord(SOUTH_HOOK).x, y: hY + header.getCoord(SOUTH_HOOK).y };
      const fTo = { x: bX + body.getCoord(NORTH_HOOK).x, y: bY + body.getCoord(NORTH_HOOK).y };
      out.edges.push({ points: new GConnectionVerticalDown().getPoints(fFrom, fTo) });

      // Back: body south → header north, going right
      const backFrom = { x: bX + body.getCoord(SOUTH_HOOK).x, y: bY + body.getCoord(SOUTH_HOOK).y };
      const backTo = { x: hX + header.getCoord(NORTH_HOOK).x, y: hY + header.getCoord(NORTH_HOOK).y };
      const rightMargin = (x + t.backEdgeRightX) - backFrom.x;
      out.edges.push({ points: new GConnectionVerticalDownThenBack(rightMargin).getPoints(backFrom, backTo) });
      return;
    }

    case 'gtile-repeat': {
      const t = tile as unknown as GtileRepeat;
      const rawChildren = t.children;
      const body = rawChildren[0]!;
      const condition = rawChildren[1]!;
      const backwardBody = rawChildren.length > 2 ? rawChildren[2]! : null;
      const contentCenterX = x + tile.width / 2;

      const bodyX = contentCenterX - body.width / 2;
      const bodyY = y + t.bodyOffsetY;
      walkTile(body, bodyX, bodyY, null, out);

      const condX = contentCenterX - condition.width / 2;
      const condY = y + t.conditionOffsetY;

      const fFrom = { x: bodyX + body.getCoord(SOUTH_HOOK).x, y: bodyY + body.getCoord(SOUTH_HOOK).y };
      const fTo = { x: condX + condition.getCoord(NORTH_HOOK).x, y: condY + condition.getCoord(NORTH_HOOK).y };
      out.edges.push({ points: new GConnectionVerticalDown().getPoints(fFrom, fTo) });

      walkTile(condition, condX, condY, 'repeat-cond', out);

      if (backwardBody !== null) {
        const bwX = contentCenterX - backwardBody.width / 2;
        const bwY = y + t.backwardOffsetY!;
        const bwFrom = { x: condX + condition.getCoord(SOUTH_HOOK).x, y: condY + condition.getCoord(SOUTH_HOOK).y };
        const bwTo = { x: bwX + backwardBody.getCoord(NORTH_HOOK).x, y: bwY + backwardBody.getCoord(NORTH_HOOK).y };
        out.edges.push({ points: new GConnectionVerticalDown().getPoints(bwFrom, bwTo) });

        walkTile(backwardBody, bwX, bwY, null, out);

        const backFrom = { x: bwX + backwardBody.getCoord(SOUTH_HOOK).x, y: bwY + backwardBody.getCoord(SOUTH_HOOK).y };
        const backTo = { x: bodyX + body.getCoord(NORTH_HOOK).x, y: bodyY + body.getCoord(NORTH_HOOK).y };
        const leftMargin = backFrom.x - (x + t.backEdgeLeftX);
        out.edges.push({ points: new GConnectionDownThenUp(leftMargin).getPoints(backFrom, backTo) });
      } else {
        // Back: condition south → body north, going left
        const backFrom = { x: condX + condition.getCoord(SOUTH_HOOK).x, y: condY + condition.getCoord(SOUTH_HOOK).y };
        const backTo = { x: bodyX + body.getCoord(NORTH_HOOK).x, y: bodyY + body.getCoord(NORTH_HOOK).y };
        const leftMargin = backFrom.x - (x + t.backEdgeLeftX);
        out.edges.push({ points: new GConnectionDownThenUp(leftMargin).getPoints(backFrom, backTo) });
      }
      return;
    }

    case 'gtile-fork':
    case 'gtile-split': {
      const t = tile as unknown as GtileFork;
      const topKind = tile.kind === 'gtile-fork' ? 'fork-bar' : 'split-bar';
      out.nodes.push({ id: out.nextId(topKind), kind: topKind, x, y, width: t.barWidth, height: BAR_HEIGHT });

      const joinBarY = y + tile.height - BAR_HEIGHT;
      out.nodes.push({ id: out.nextId('join-bar'), kind: 'join-bar', x, y: joinBarY, width: t.barWidth, height: BAR_HEIGHT });

      const barCenterX = x + t.barWidth / 2;
      for (let i = 0; i < t.children.length; i++) {
        const branch = t.children[i]!;
        const bX = x + t.branchOffsets[i]!;
        const bY = y + t.branchTopY;
        walkTile(branch, bX, bY, null, out);

        const fFrom = { x: barCenterX, y: y + BAR_HEIGHT };
        const fTo = { x: bX + branch.getCoord(NORTH_HOOK).x, y: bY + branch.getCoord(NORTH_HOOK).y };
        out.edges.push({ points: new GConnectionSideThenVerticalThenSide().getPoints(fFrom, fTo) });

        const jFrom = { x: bX + branch.getCoord(SOUTH_HOOK).x, y: bY + branch.getCoord(SOUTH_HOOK).y };
        const jTo = { x: barCenterX, y: joinBarY };
        out.edges.push({ points: new GConnectionSideThenVerticalThenSide().getPoints(jFrom, jTo) });
      }
      return;
    }

    case 'gtile-switch': {
      const t = tile as unknown as GtileSwitch;
      const centerX = x + tile.width / 2;
      const hasMerge = t.mergeOffsetY !== null;
      const rawChildren = t.children;
      const diamond = rawChildren[0]!;
      const cases = hasMerge ? rawChildren.slice(1, -1) : rawChildren.slice(1);
      const mergeDiamond = hasMerge ? rawChildren[rawChildren.length - 1]! : null;

      const dX = centerX - diamond.width / 2;
      const dY = y + t.diamondOffsetY;
      walkTile(diamond, dX, dY, 'if-split', out);

      for (let i = 0; i < cases.length; i++) {
        const c = cases[i]!;
        const cX = x + t.caseOffsets[i]!;
        const cY = y + t.caseOffsetY;
        walkTile(c, cX, cY, null, out);

        const from = { x: dX + diamond.getCoord(SOUTH_HOOK).x, y: dY + diamond.getCoord(SOUTH_HOOK).y };
        const to = { x: cX + c.getCoord(NORTH_HOOK).x, y: cY + c.getCoord(NORTH_HOOK).y };
        out.edges.push({ points: new GConnectionSideThenVerticalThenSide().getPoints(from, to) });

        if (mergeDiamond !== null) {
          const mX = centerX - mergeDiamond.width / 2;
          const mY = y + t.mergeOffsetY!;
          const mFrom = { x: cX + c.getCoord(SOUTH_HOOK).x, y: cY + c.getCoord(SOUTH_HOOK).y };
          const mTo = { x: mX + mergeDiamond.getCoord(NORTH_HOOK).x, y: mY + mergeDiamond.getCoord(NORTH_HOOK).y };
          out.edges.push({ points: new GConnectionSideThenVerticalThenSide().getPoints(mFrom, mTo) });
        }
      }

      if (mergeDiamond !== null) {
        const mX = centerX - mergeDiamond.width / 2;
        const mY = y + t.mergeOffsetY!;
        walkTile(mergeDiamond, mX, mY, 'if-merge', out);
      }
      return;
    }

    case 'gtile-group':
    case 'gtile-partition': {
      const t = tile as unknown as GtileGroup;
      const gKind = tile.kind === 'gtile-group' ? 'group' : 'partition';
      out.nodes.push({ id: out.nextId(gKind), kind: gKind, x, y, width: tile.width, height: tile.height });
      if (t.children.length > 0) {
        walkTile(t.children[0]!, x + t.bodyOffsetX, y + t.bodyOffsetY, null, out);
      }
      return;
    }

    default:
      out.nodes.push({ id: out.nextId('unknown'), kind: tile.kind, x, y, width: tile.width, height: tile.height });
      return;
  }
}

export function assignCoordinates(
  root: Tile,
  ast: ActivityDiagramAST,
  baseX: number,
  baseY: number,
  _bounder: StringBounder,
  _theme: Theme,
): ActivityGeometry {
  const nodes: ActivityNodeGeo[] = [];
  const edges: ActivityEdgeGeo[] = [];
  let idCounter = 0;
  const out: Out = {
    nodes,
    edges,
    nextId: (prefix: string) => `${prefix}-${++idCounter}`,
  };

  walkTile(root, baseX, baseY, null, out);

  let swimlanes: SwimlaneGeo[] = [];
  if (ast.swimlanes.length > 0) {
    const laneWidth = Math.max(SWIMLANE_MIN_WIDTH, root.width / ast.swimlanes.length);
    const contexts = buildSwimlaneContexts(ast.swimlanes, baseX, laneWidth);
    swimlanes = contexts.map(ctx => ({ name: ctx.name, x: ctx.x, width: ctx.width }));
  }

  let maxX = baseX + root.width;
  let maxY = baseY + root.height;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  for (const e of edges) {
    for (const p of e.points) {
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  return {
    totalWidth: maxX + LAYOUT_MARGIN,
    totalHeight: maxY + LAYOUT_MARGIN,
    nodes,
    edges,
    swimlanes,
  };
}
