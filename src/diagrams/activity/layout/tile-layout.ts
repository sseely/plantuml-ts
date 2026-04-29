import type { ActivityDiagramAST, ActivityNode, ActivityIf, ActivityWhile, ActivityRepeat, ActivityFork, ActivitySplit } from '../ast.js';
import type { StringMeasurer } from '../../../core/measurer.js';
import type { Theme } from '../../../core/theme.js';
import type { StringBounder, Tile } from '../tiles/tile.js';
import { GtileStart } from '../tiles/gtile-start.js';
import { GtileStop } from '../tiles/gtile-stop.js';
import { GtileEnd } from '../tiles/gtile-end.js';
import { GtileKill } from '../tiles/gtile-kill.js';
import { GtileBreak } from '../tiles/gtile-break.js';
import { GtileAction } from '../tiles/gtile-action.js';
import { GtileNote } from '../tiles/gtile-note.js';
import { GtileDiamond } from '../tiles/gtile-diamond.js';
import { GtileIf } from '../tiles/gtile-if.js';
import { GtileWhile } from '../tiles/gtile-while.js';
import { GtileRepeat } from '../tiles/gtile-repeat.js';
import { GtileFork } from '../tiles/gtile-fork.js';
import { GtileSplit } from '../tiles/gtile-split.js';
import { GtileTopDown } from '../tiles/gtile-top-down.js';
import { assignCoordinates, LAYOUT_MARGIN } from './tile-coordinates.js';

// Re-export geometry types so renderer and index can import from one place.
export type {
  ActivityGeometry,
  ActivityNodeGeo,
  ActivityEdgeGeo,
  SwimlaneGeo,
} from '../layout.old.js';

function makeBounder(measurer: StringMeasurer, theme: Theme): StringBounder {
  return {
    getDimension(text: string, fontSizePt: number) {
      return measurer.measure(text, { family: theme.fontFamily, size: fontSizePt });
    },
  };
}

function tileNodes(nodes: ActivityNode[], bounder: StringBounder, theme: Theme): Tile[] {
  const tiles: Tile[] = [];
  for (const node of nodes) {
    const t = tileNode(node, bounder, theme);
    if (t !== null) tiles.push(t);
  }
  return tiles;
}

function tileNode(node: ActivityNode, bounder: StringBounder, theme: Theme): Tile | null {
  switch (node.kind) {
    case 'start':
      return new GtileStart();
    case 'stop':
      return new GtileStop();
    case 'end':
      return new GtileEnd();
    case 'kill':
      return new GtileKill();
    case 'detach':
      return new GtileStop();
    case 'break':
      return new GtileBreak();
    case 'action':
      return new GtileAction(node, bounder, theme);
    case 'note':
      return new GtileNote(node, bounder, theme);
    case 'arrow-label':
      return null;
    case 'if':
      return tileIf(node, bounder, theme);
    case 'while':
      return tileWhile(node, bounder, theme);
    case 'repeat':
      return tileRepeat(node, bounder, theme);
    case 'fork':
      return tileFork(node, bounder, theme);
    case 'split':
      return tileSplit(node, bounder, theme);
    default: {
      const _exhaustive: never = node;
      console.warn(`tile-layout: unknown node kind '${String((_exhaustive as ActivityNode).kind)}'`);
      return null;
    }
  }
}

function tileIf(node: ActivityIf, bounder: StringBounder, theme: Theme): GtileIf {
  const diamond = new GtileDiamond(node.condition, bounder, theme);
  const branches: Array<{ tile: Tile; label?: string }> = [];

  const thenTiles = tileNodes(node.thenBranch, bounder, theme);
  const thenEntry: { tile: Tile; label?: string } = { tile: new GtileTopDown(thenTiles, bounder, theme) };
  if (node.thenLabel !== undefined) thenEntry.label = node.thenLabel;
  branches.push(thenEntry);

  for (const elseif of node.elseIfBranches) {
    const elseifTiles = tileNodes(elseif.body, bounder, theme);
    const entry: { tile: Tile; label?: string } = { tile: new GtileTopDown(elseifTiles, bounder, theme) };
    if (elseif.label !== undefined) entry.label = elseif.label;
    branches.push(entry);
  }

  const elseTiles = tileNodes(node.elseBranch, bounder, theme);
  const elseEntry: { tile: Tile; label?: string } = { tile: new GtileTopDown(elseTiles, bounder, theme) };
  if (node.elseLabel !== undefined) elseEntry.label = node.elseLabel;
  branches.push(elseEntry);

  return new GtileIf(diamond, branches, null, bounder, theme);
}

function tileWhile(node: ActivityWhile, bounder: StringBounder, theme: Theme): GtileWhile {
  const header = new GtileDiamond(node.condition, bounder, theme);
  const bodyTiles = tileNodes(node.body, bounder, theme);
  const body = new GtileTopDown(bodyTiles, bounder, theme);
  return new GtileWhile(header, body, node.exitLabel, node.yesLabel, bounder, theme);
}

function tileRepeat(node: ActivityRepeat, bounder: StringBounder, theme: Theme): GtileRepeat {
  const bodyTiles = tileNodes(node.body, bounder, theme);
  const body = new GtileTopDown(bodyTiles, bounder, theme);
  const condition = new GtileDiamond(node.condition, bounder, theme);
  return new GtileRepeat(body, condition, null, bounder, theme);
}

function tileFork(node: ActivityFork, bounder: StringBounder, theme: Theme): GtileFork {
  const branches = node.branches.map(b => {
    const tiles = tileNodes(b, bounder, theme);
    return new GtileTopDown(tiles, bounder, theme);
  });
  return new GtileFork(branches, bounder);
}

function tileSplit(node: ActivitySplit, bounder: StringBounder, theme: Theme): GtileSplit {
  const branches = node.branches.map(b => {
    const tiles = tileNodes(b, bounder, theme);
    return new GtileTopDown(tiles, bounder, theme);
  });
  return new GtileSplit(branches, bounder);
}

export function layoutActivity(
  ast: ActivityDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
) {
  if (ast.nodes.length === 0) {
    return { totalWidth: 0, totalHeight: 0, nodes: [], edges: [], swimlanes: [] };
  }

  const bounder = makeBounder(measurer, theme);
  const tiles = tileNodes(ast.nodes, bounder, theme);
  const root = new GtileTopDown(tiles, bounder, theme);
  return assignCoordinates(root, ast, LAYOUT_MARGIN, LAYOUT_MARGIN, bounder, theme);
}
