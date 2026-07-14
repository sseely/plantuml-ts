import { parse, ParseError } from 'graphviz-ts';
import { createAnnotations, matchAnnotationCommand } from '../../core/annotations/index.js';
import type { DiagramAnnotations } from '../../core/annotations/index.js';
import { createSpriteRegistry, matchSpriteCommand } from '../../core/sprite-commands.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';
import type {
  DotDiagramAST,
  DotClusterDef,
  DotEdgeDef,
  DotGraphType,
  DotNodeDef,
  DotNodeShape,
} from './ast.js';

// ---------------------------------------------------------------------------
// DOT parsing for @startdot is delegated to graphviz-ts's grammar parser
// (a real peggy DOT grammar). PlantUML itself just feeds DOT to graphviz, so
// we do the same: strip the PlantUML-only directives (title/skinparam), hand
// the DOT body to graphviz-ts's parse(), and map its Graph model to our AST.
// A parse failure is surfaced up (thrown) so the render pipeline reports it,
// rather than being silently swallowed.
// ---------------------------------------------------------------------------

type GvGraph = ReturnType<typeof parse>;
type GvNode = GvGraph['nodes'] extends Map<string, infer N> ? N : never;
type GvEdge = GvGraph['edges'][number];

const SAFE_EMPTY_AST: DotDiagramAST = {
  graphType: 'digraph',
  strict: false,
  name: null,
  rankDir: null,
  nodeSep: null,
  rankSep: null,
  skinparamLines: [],
  rawStyles: [],
  nodes: [],
  edges: [],
  clusters: [],
  annotations: createAnnotations(),
  sprites: createSpriteRegistry(),
};

// ---------------------------------------------------------------------------
// Small shared helpers (kept from the hand-written parser)
// ---------------------------------------------------------------------------

function normaliseShape(raw: string): DotNodeShape {
  const s = raw.toLowerCase();
  if (s === 'box' || s === 'rect' || s === 'rectangle') return 'box';
  if (s === 'circle') return 'circle';
  if (s === 'diamond') return 'diamond';
  if (s === 'plaintext' || s === 'none') return 'plaintext';
  return 'ellipse';
}

/** Strip graphviz-ts's HTML-label sentinel () and all HTML tags.
 *  <b>Bold</b> → Bold */
function stripAllHtmlTags(s: string): string {
  return s.replace(//g, '').replace(/<[^>]*>/g, '');
}

function parseRankValue(val: string): DotNodeDef['rank'] {
  const v = val.toLowerCase().trim();
  if (v === 'source' || v === 'sink' || v === 'same' || v === 'min' || v === 'max') return v;
  return null;
}

function numOrNull(v: string | undefined): number | null {
  if (v === undefined) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// PlantUML pre-step: strip @startdot/@enddot + comments, lift skinparam and
// title/caption/legend/header/footer/mainframe. These are not DOT and would
// choke graphviz-ts; the remainder is the DOT body.
// ---------------------------------------------------------------------------

interface PreprocessResult {
  dotContent: string;
  skinparamLines: string[];
  annotations: DiagramAnnotations;
  sprites: SpriteRegistry;
}

function preprocess(source: string): PreprocessResult {
  const skinparamLines: string[] = [];
  const keepLines: string[] = [];
  const annotations = createAnnotations();
  const sprites = createSpriteRegistry();
  const withoutBlock = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rawLines = withoutBlock.split('\n');

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i]!;
    const trimmed = rawLine.trim();
    if (/^@startdot\s*$/i.test(trimmed) || /^@enddot\s*$/i.test(trimmed)) continue;
    const noComment = rawLine.replace(/\/\/.*$/, '');
    const t = noComment.trim();
    if (t === '') { keepLines.push(''); continue; }
    if (/^skinparam\s/i.test(t)) { skinparamLines.push(t); continue; }

    // title/caption/legend/header/footer/mainframe (mission G0b/T8) — title
    // now routes through the same shared chrome matcher as the other five
    // (T8 migrated dot's title off the bespoke `ast.title` field onto
    // `ast.annotations.title`; see ast.ts's `annotations` doc comment).
    const annotationMatch = matchAnnotationCommand(rawLines, i, annotations);
    if (annotationMatch !== null) {
      i += annotationMatch.consumed - 1;
      continue;
    }

    // `sprite $name [WxH/N[z]] { ... }` definitions (mission SI5b/T4): tried
    // immediately after the chrome matcher, same pre-DOT-body scope.
    const spriteMatch = matchSpriteCommand(rawLines, i, sprites);
    if (spriteMatch !== null) {
      i += spriteMatch.consumed - 1;
      continue;
    }

    keepLines.push(noComment);
  }
  return { dotContent: keepLines.join('\n'), skinparamLines, annotations, sprites };
}

// ---------------------------------------------------------------------------
// graphviz-ts Graph model → DotDiagramAST
// ---------------------------------------------------------------------------

/** Effective node attrs: scoped `node[...]` defaults overlaid with the node's own. */
function resolveNodeAttrs(node: GvNode): Map<string, string> {
  const m = new Map<string, string>(node.nodeDefaultsSnapshot ?? []);
  for (const [k, v] of node.attrs) m.set(k, v);
  return m;
}

function hasFilled(style: string | undefined): boolean {
  return style !== undefined && style.toLowerCase().split(/[\s,]+/).includes('filled');
}

function mapNode(node: GvNode): DotNodeDef {
  const a = resolveNodeAttrs(node);
  const def: DotNodeDef = {
    id: node.name,
    label: stripAllHtmlTags(a.get('label') ?? node.name),
    shape: normaliseShape(a.get('shape') ?? 'ellipse'),
    widthIn: numOrNull(a.get('width')),
    heightIn: numOrNull(a.get('height')),
    rank: null,
  };
  const color = a.get('color');
  if (color !== undefined) def.nodeColor = color;
  const fill = a.get('fillcolor');
  if (fill !== undefined) def.fillColor = fill;
  if (hasFilled(a.get('style'))) def.styleFilled = true;
  return def;
}

function edgeDir(v: string | undefined): DotEdgeDef['dir'] | undefined {
  const d = (v ?? '').toLowerCase();
  return d === 'forward' || d === 'back' || d === 'both' || d === 'none' ? d : undefined;
}

function edgeStyleOf(v: string | undefined): DotEdgeDef['edgeStyle'] | undefined {
  const s = (v ?? '').toLowerCase();
  return s === 'dashed' || s === 'dotted' || s === 'bold' ? s : undefined;
}

function mapEdge(edge: GvEdge, index: number): DotEdgeDef {
  const a = edge.attrs;
  const label = a.get('label');
  const def: DotEdgeDef = {
    id: `e${index}`,
    from: edge.tail.name,
    to: edge.head.name,
    label: label !== undefined ? stripAllHtmlTags(label) : null,
    weight: numOrNull(a.get('weight')),
    minLen: numOrNull(a.get('minlen')),
  };
  const dir = edgeDir(a.get('dir'));
  if (dir !== undefined) def.dir = dir;
  const style = edgeStyleOf(a.get('style'));
  if (style !== undefined) def.edgeStyle = style;
  return def;
}

/** All node names within a subgraph (its own + nested + edge endpoints). */
function collectMemberIds(sg: GvGraph, into: Set<string>): void {
  for (const name of sg.nodes.keys()) into.add(name);
  for (const e of sg.edges) {
    into.add(e.tail.name);
    into.add(e.head.name);
  }
  for (const sub of sg.subgraphs.values()) collectMemberIds(sub, into);
}

/** Apply rank constraints to member nodes and register clusters (name "cluster*"). */
function walkSubgraphs(
  parent: GvGraph,
  nodeMap: Map<string, DotNodeDef>,
  clusters: DotClusterDef[],
): void {
  for (const sg of parent.subgraphs.values()) {
    const rank = parseRankValue(sg.attrs.get('rank') ?? '');
    if (rank !== null) {
      const ids = new Set<string>();
      collectMemberIds(sg, ids);
      for (const id of ids) {
        const n = nodeMap.get(id);
        if (n !== undefined) n.rank = rank;
      }
    }
    if (/^cluster/i.test(sg.name)) {
      const ids = new Set<string>();
      collectMemberIds(sg, ids);
      const label = sg.attrs.get('label');
      clusters.push({
        id: sg.name,
        label: label !== undefined ? stripAllHtmlTags(label) : null,
        nodeIds: [...ids],
      });
    }
    walkSubgraphs(sg, nodeMap, clusters);
  }
}

function rankDirOf(g: GvGraph): DotDiagramAST['rankDir'] {
  const rd = (g.attrs.get('rankdir') ?? '').toUpperCase();
  return rd === 'TB' || rd === 'LR' || rd === 'BT' || rd === 'RL' ? rd : null;
}

// ---------------------------------------------------------------------------
// Strict deduplication (parallel edges collapse in a `strict` graph)
// ---------------------------------------------------------------------------

function deduplicateEdges(edges: DotEdgeDef[]): DotEdgeDef[] {
  const seen = new Set<string>();
  const result: DotEdgeDef[] = [];
  for (const edge of edges) {
    const key = `${edge.from}\x00${edge.to}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(edge);
    }
  }
  return result;
}

/** `strict` dedups parallel edges; non-strict graphs keep them all. */
function computeEdges(g: GvGraph, strict: boolean): DotEdgeDef[] {
  const edges = g.edges.map((e, i) => mapEdge(e, i));
  return strict ? deduplicateEdges(edges) : edges;
}

function graphKind(g: GvGraph): { strict: boolean; graphType: DotGraphType } {
  const strict = g.kind.startsWith('strict');
  const directed = g.kind === 'directed' || g.kind === 'strict-directed';
  return { strict, graphType: directed ? 'digraph' : 'graph' };
}

function graphToAst(
  g: GvGraph,
  skinparamLines: string[],
  annotations: DiagramAnnotations,
  sprites: SpriteRegistry,
): DotDiagramAST {
  const nodeMap = new Map<string, DotNodeDef>();
  for (const node of g.nodes.values()) nodeMap.set(node.name, mapNode(node));

  const clusters: DotClusterDef[] = [];
  walkSubgraphs(g, nodeMap, clusters);

  const { strict, graphType } = graphKind(g);

  return {
    graphType,
    strict,
    name: g.name === '' ? null : g.name,
    rankDir: rankDirOf(g),
    nodeSep: numOrNull(g.attrs.get('nodesep')),
    rankSep: numOrNull(g.attrs.get('ranksep')),
    skinparamLines,
    rawStyles: [],
    nodes: [...nodeMap.values()],
    edges: computeEdges(g, strict),
    clusters,
    annotations,
    sprites,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseDot(source: string): DotDiagramAST {
  if (source.trim() === '') {
    return { ...SAFE_EMPTY_AST, annotations: createAnnotations(), sprites: createSpriteRegistry() };
  }

  const { dotContent, skinparamLines, annotations, sprites } = preprocess(source);
  // No DOT body (e.g. only a title) — nothing to lay out, no error.
  if (dotContent.trim() === '') return { ...SAFE_EMPTY_AST, skinparamLines, annotations, sprites };

  let graph: GvGraph;
  try {
    graph = parse(dotContent);
  } catch (err) {
    // Like PlantUML feeding graphviz: surface the parse failure up so the
    // render pipeline reports it, instead of silently producing nothing.
    const detail = err instanceof ParseError ? err.friendlyMessage : String(err);
    throw new Error(`@startdot: could not parse DOT — ${detail}`);
  }
  return graphToAst(graph, skinparamLines, annotations, sprites);
}
