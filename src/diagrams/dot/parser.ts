import type {
  DotDiagramAST,
  DotClusterDef,
  DotEdgeDef,
  DotGraphType,
  DotNodeDef,
  DotNodeShape,
} from './ast.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAFE_EMPTY_AST: DotDiagramAST = {
  graphType: 'digraph',
  strict: false,
  name: null,
  title: null,
  rankDir: null,
  nodeSep: null,
  rankSep: null,
  skinparamLines: [],
  rawStyles: [],
  nodes: [],
  edges: [],
  clusters: [],
};

// ---------------------------------------------------------------------------
// Shape normalisation (D1)
// ---------------------------------------------------------------------------

function normaliseShape(raw: string): DotNodeShape {
  const s = raw.toLowerCase();
  if (s === 'box' || s === 'rect' || s === 'rectangle') return 'box';
  if (s === 'circle') return 'circle';
  if (s === 'diamond') return 'diamond';
  if (s === 'plaintext' || s === 'none') return 'plaintext';
  return 'ellipse';
}

// ---------------------------------------------------------------------------
// Attribute list parser  [key=value, key="value", key=<html>]
// ---------------------------------------------------------------------------

interface AttrList {
  [key: string]: string;
}

/**
 * Strip outer double-quotes from a token, if present.
 */
function unquote(s: string): string {
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Strip all HTML tags from a string.  <b>Bold</b> → Bold
 */
function stripAllHtmlTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

/**
 * Parse a DOT attribute list from the content between `[` and `]`.
 * Handles quoted values, HTML labels, and comma/whitespace separators.
 *
 * HTML label handling: in PlantUML's @startdot, an HTML label like
 * `<b>Bold</b>` is the entire value up to the next comma or end.  We
 * collect everything from `<` to the last `>` before a `,` delimiter,
 * then strip all HTML tags from the collected string.
 */
function parseAttrList(content: string): AttrList {
  const attrs: AttrList = {};

  let i = 0;
  const len = content.length;

  function skipWs(): void {
    while (i < len && (content[i] === ' ' || content[i] === '\t' || content[i] === '\n' || content[i] === '\r' || content[i] === ',')) {
      i++;
    }
  }

  function readKey(): string {
    skipWs();
    let key = '';
    while (i < len && content[i] !== '=' && content[i] !== ',' && content[i] !== ' ' && content[i] !== '\t') {
      key += content[i++];
    }
    return key.trim();
  }

  function readValue(): string {
    skipWs();
    if (i >= len) return '';
    const ch = content[i]!;

    if (ch === '"') {
      // Quoted string
      i++; // skip opening "
      let val = '';
      while (i < len && content[i] !== '"') {
        if (content[i] === '\\' && i + 1 < len) {
          i++; // skip backslash
          val += content[i++];
        } else {
          val += content[i++];
        }
      }
      if (i < len) i++; // skip closing "
      return val;
    }

    if (ch === '<') {
      // HTML label value.  In PlantUML @startdot, the label is everything
      // from `<` up to (and including) the last `>` before a `,` or end.
      // We collect raw content then strip all HTML tags.
      let raw = '';
      while (i < len && content[i] !== ',') {
        raw += content[i++];
      }
      // Trim trailing whitespace
      raw = raw.trim();
      return stripAllHtmlTags(raw);
    }

    // Unquoted value — read until comma, whitespace, or end
    let val = '';
    while (i < len && content[i] !== ',' && content[i] !== ' ' && content[i] !== '\t' && content[i] !== '\n') {
      val += content[i++];
    }
    return val;
  }

  while (i < len) {
    skipWs();
    if (i >= len) break;
    const key = readKey();
    if (key === '') { i++; continue; }
    skipWs();
    if (i < len && content[i] === '=') {
      i++; // consume '='
      const val = readValue();
      attrs[key] = val;
    }
    // else: bare key without value — skip
  }

  return attrs;
}

// ---------------------------------------------------------------------------
// Node-id extraction (handles quoted identifiers)
// ---------------------------------------------------------------------------

function parseNodeId(raw: string): string {
  return unquote(raw.trim());
}

// ---------------------------------------------------------------------------
// Pre-processing: strip comments, @start/@end, title, skinparam
// ---------------------------------------------------------------------------

interface PreprocessResult {
  dotContent: string;
  title: string | null;
  skinparamLines: string[];
}

function preprocess(source: string): PreprocessResult {
  let title: string | null = null;
  const skinparamLines: string[] = [];
  const keepLines: string[] = [];

  // First: strip block comments /* … */
  const withoutBlock = source.replace(/\/\*[\s\S]*?\*\//g, '');

  for (const rawLine of withoutBlock.split('\n')) {
    const trimmed = rawLine.trim();

    // Strip @startdot / @enddot
    if (/^@startdot\s*$/i.test(trimmed) || /^@enddot\s*$/i.test(trimmed)) continue;

    // Strip line comments
    const noComment = rawLine.replace(/\/\/.*$/, '');

    const t = noComment.trim();
    if (t === '') { keepLines.push(''); continue; }

    // Extract title
    const titleMatch = /^title\s+(.+)$/i.exec(t);
    if (titleMatch) {
      title = titleMatch[1]!.trim();
      continue;
    }

    // Collect skinparam lines
    if (/^skinparam\s/i.test(t)) {
      skinparamLines.push(t);
      continue;
    }

    keepLines.push(noComment);
  }

  return { dotContent: keepLines.join('\n'), title, skinparamLines };
}

// ---------------------------------------------------------------------------
// Graph header parser
// ---------------------------------------------------------------------------

interface GraphHeader {
  strict: boolean;
  graphType: DotGraphType;
  name: string | null;
  bodyStart: number; // index just after the opening `{`
}

/**
 * Find and parse the graph header:
 *   [strict] (digraph|graph) [name] {
 * Returns null if no valid header found.
 */
function parseGraphHeader(text: string): GraphHeader | null {
  // Match optional strict, then digraph or graph, optional name, opening brace
  const re = /\b(strict\s+)?(digraph|graph)\s*([a-zA-Z_][a-zA-Z0-9_]*)?\s*\{/i;
  const m = re.exec(text);
  if (!m) return null;

  const strict = m[1] !== undefined && m[1].trim().toLowerCase() === 'strict';
  const graphType: DotGraphType = m[2]!.toLowerCase() === 'digraph' ? 'digraph' : 'graph';
  const rawName = m[3];
  const name = rawName !== undefined && rawName !== '' ? rawName : null;
  const bodyStart = m.index + m[0].length;

  return { strict, graphType, name, bodyStart };
}

// ---------------------------------------------------------------------------
// Brace-balanced body extraction
// ---------------------------------------------------------------------------

/**
 * Extract the content between the outer braces, tracking depth.
 * Returns the content (without the outer braces) or null if malformed.
 */
function extractBody(text: string, startIdx: number): string | null {
  // startIdx is immediately after the opening `{`
  let depth = 1;
  let i = startIdx;
  let inString = false;

  while (i < text.length && depth > 0) {
    const ch = text[i]!;
    if (inString) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === '"') inString = false;
    } else {
      if (ch === '"') { inString = true; }
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return text.slice(startIdx, i);
      }
    }
    i++;
  }

  // Unterminated — return everything remaining
  return text.slice(startIdx);
}

// ---------------------------------------------------------------------------
// Statement splitter
// ---------------------------------------------------------------------------

/**
 * Split graph body text into individual statements.
 * Statements are terminated by `;` or newline (outside of strings/brackets).
 * Subgraph bodies (balanced braces) are returned as a single statement.
 */
function splitStatements(body: string): string[] {
  const stmts: string[] = [];
  let i = 0;
  let current = '';
  let braceDepth = 0;
  let inString = false;

  while (i < body.length) {
    const ch = body[i]!;

    if (inString) {
      current += ch;
      if (ch === '\\' && i + 1 < body.length) {
        current += body[++i]!;
      } else if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      current += ch;
      i++;
      continue;
    }

    if (ch === '{') {
      braceDepth++;
      current += ch;
      i++;
      continue;
    }

    if (ch === '}') {
      braceDepth--;
      current += ch;
      i++;
      if (braceDepth === 0) {
        // End of a subgraph block — flush as a statement
        const s = current.trim();
        if (s !== '') stmts.push(s);
        current = '';
      }
      continue;
    }

    if (braceDepth === 0 && (ch === ';' || ch === '\n')) {
      const s = current.trim();
      if (s !== '') stmts.push(s);
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  const s = current.trim();
  if (s !== '') stmts.push(s);

  return stmts;
}

// ---------------------------------------------------------------------------
// Attribute list extraction from a statement
// ---------------------------------------------------------------------------

/**
 * Extract the content between `[` and matching `]`.
 * Returns { attrContent, beforeAttr } or null if no attribute list present.
 */
function extractAttrList(stmt: string): { attrContent: string; beforeAttr: string } | null {
  const bracketIdx = stmt.indexOf('[');
  if (bracketIdx === -1) return null;

  let depth = 0;
  let start = -1;
  for (let i = bracketIdx; i < stmt.length; i++) {
    if (stmt[i] === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (stmt[i] === ']') {
      depth--;
      if (depth === 0) {
        return {
          attrContent: stmt.slice(start + 1, i),
          beforeAttr: stmt.slice(0, start).trim(),
        };
      }
    }
  }

  return { attrContent: stmt.slice(bracketIdx + 1), beforeAttr: stmt.slice(0, bracketIdx).trim() };
}

// ---------------------------------------------------------------------------
// Default node/edge attributes
// ---------------------------------------------------------------------------

interface NodeDefaults {
  shape: DotNodeShape;
  nodeColor?: string;
  fillColor?: string;
  styleFilled?: boolean;
}

// ---------------------------------------------------------------------------
// Statement parser context
// ---------------------------------------------------------------------------

interface ParseContext {
  nodes: Map<string, DotNodeDef>;    // id → node
  edges: DotEdgeDef[];
  edgeIndex: number;
  clusters: DotClusterDef[];
  nodeDefaults: NodeDefaults;
  rankDir: 'TB' | 'LR' | 'BT' | 'RL' | null;
  nodeSep: number | null;
  rankSep: number | null;
}

function ensureNode(ctx: ParseContext, id: string): DotNodeDef {
  const existing = ctx.nodes.get(id);
  if (existing) return existing;
  const node: DotNodeDef = {
    id,
    label: id,
    shape: ctx.nodeDefaults.shape,
    widthIn: null,
    heightIn: null,
    rank: null,
  };
  if (ctx.nodeDefaults.nodeColor !== undefined) node.nodeColor = ctx.nodeDefaults.nodeColor;
  if (ctx.nodeDefaults.fillColor !== undefined) node.fillColor = ctx.nodeDefaults.fillColor;
  if (ctx.nodeDefaults.styleFilled !== undefined) node.styleFilled = ctx.nodeDefaults.styleFilled;
  ctx.nodes.set(id, node);
  return node;
}

/**
 * Apply attrs object to a DotNodeDef, mutating it in place.
 */
function applyNodeAttrs(node: DotNodeDef, attrs: AttrList): void {
  if (attrs['label'] !== undefined) node.label = attrs['label'];
  if (attrs['shape'] !== undefined) node.shape = normaliseShape(attrs['shape']);
  if (attrs['width'] !== undefined) {
    const w = parseFloat(attrs['width']);
    if (!isNaN(w)) node.widthIn = w;
  }
  if (attrs['height'] !== undefined) {
    const h = parseFloat(attrs['height']);
    if (!isNaN(h)) node.heightIn = h;
  }
  if (attrs['color'] !== undefined) node.nodeColor = attrs['color'];
  if (attrs['fillcolor'] !== undefined) node.fillColor = attrs['fillcolor'];
  // C checkStyle(): style is a comma/space-separated list; "filled" sets istyle.filled.
  if (attrs['style'] !== undefined) {
    const styles = attrs['style'].toLowerCase().split(/[\s,]+/);
    if (styles.includes('filled')) node.styleFilled = true;
  }
}

/**
 * Parse a rank value from a subgraph attr string.
 */
function parseRankValue(val: string): DotNodeDef['rank'] {
  const v = val.toLowerCase().trim();
  if (v === 'source') return 'source';
  if (v === 'sink') return 'sink';
  if (v === 'same') return 'same';
  if (v === 'min') return 'min';
  if (v === 'max') return 'max';
  return null;
}

/**
 * Extract all bare node ids (not edge chains) from subgraph body text.
 * Returns ids that look like standalone identifiers (no -> or --).
 */
function extractSubgraphNodeIds(bodyText: string): string[] {
  const stmts = splitStatements(bodyText);
  const ids: string[] = [];
  for (const stmt of stmts) {
    // Skip graph/subgraph attribute assignments: atom '=' atom (DOT grammar: graphattrdefs).
    // e.g. label=Backend, bgcolor=white, rankdir=LR — these set subgraph attrs, not nodes.
    if (/^[\w"]+\s*=/.test(stmt.trim())) continue;
    // Skip edge statements
    if (/->|--/.test(stmt)) continue;
    // Skip subgraph keyword
    if (/^subgraph\b/i.test(stmt)) continue;
    // Skip node/edge/graph keyword statements with attr lists
    const lower = stmt.toLowerCase().trim();
    if (lower.startsWith('node') || lower.startsWith('edge') || lower.startsWith('graph')) continue;

    // Looks like a node id (possibly quoted)
    const maybeId = parseNodeId(stmt.replace(/\[.*\]/, '').trim());
    if (maybeId !== '') ids.push(maybeId);
  }
  return ids;
}

/**
 * Process a single statement, mutating ctx.
 */
function processStatement(stmt: string, ctx: ParseContext): void {
  const lower = stmt.toLowerCase().trim();

  // --- graph [attr-list] ---
  if (/^graph\s*\[/i.test(stmt) || stmt.toLowerCase().trim() === 'graph' || /^graph\s+\[/i.test(stmt)) {
    const extracted = extractAttrList(stmt);
    if (extracted) {
      const attrs = parseAttrList(extracted.attrContent);
      const rd = (attrs['rankdir'] ?? attrs['rankDir'] ?? attrs['RankDir'] ?? '').toUpperCase();
      if (rd === 'TB' || rd === 'LR' || rd === 'BT' || rd === 'RL') ctx.rankDir = rd;
      const ns = attrs['nodesep'] ?? attrs['nodeSep'];
      if (ns !== undefined) { const v = parseFloat(ns); if (!isNaN(v)) ctx.nodeSep = v; }
      const rs = attrs['ranksep'] ?? attrs['rankSep'];
      if (rs !== undefined) { const v = parseFloat(rs); if (!isNaN(v)) ctx.rankSep = v; }
    }
    return;
  }

  // --- node [attr-list] → set default node attributes ---
  if (/^node\s*\[/i.test(stmt) || lower === 'node') {
    const extracted = extractAttrList(stmt);
    if (extracted) {
      const attrs = parseAttrList(extracted.attrContent);
      if (attrs['shape'] !== undefined) ctx.nodeDefaults.shape = normaliseShape(attrs['shape']);
      if (attrs['color'] !== undefined) ctx.nodeDefaults.nodeColor = attrs['color'];
      if (attrs['fillcolor'] !== undefined) ctx.nodeDefaults.fillColor = attrs['fillcolor'];
      if (attrs['style'] !== undefined) {
        const styles = attrs['style'].toLowerCase().split(/[\s,]+/);
        if (styles.includes('filled')) ctx.nodeDefaults.styleFilled = true;
      }
    }
    return;
  }

  // --- edge [attr-list] → set default edge attributes (currently no defaults used) ---
  if (/^edge\s*\[/i.test(stmt) || lower === 'edge') {
    return; // edge defaults not needed for current feature set
  }

  // --- subgraph { … } or { … } ---
  if (/^(?:subgraph\s*(?:[a-zA-Z_"][^{]*)?)?\{/i.test(stmt) || stmt.startsWith('{')) {
    const braceIdx = stmt.indexOf('{');
    if (braceIdx === -1) return;

    // Extract subgraph name (if any) from the header before '{'
    const header = stmt.slice(0, braceIdx).trim();
    const nameMatch = /^subgraph\s+([a-zA-Z_][^\s{]*)/i.exec(header);
    const subgraphName = nameMatch?.[1] ?? null;
    const isCluster = subgraphName !== null && /^cluster/i.test(subgraphName);

    const bodyText = extractBody(stmt, braceIdx + 1) ?? '';

    // Determine rank from body
    let rank: DotNodeDef['rank'] = null;
    const rankMatch = /\brank\s*=\s*["']?(\w+)["']?/i.exec(bodyText);
    if (rankMatch) rank = parseRankValue(rankMatch[1] ?? '');

    // Collect node ids from subgraph body
    const nodeIds = extractSubgraphNodeIds(bodyText);
    for (const id of nodeIds) {
      const node = ensureNode(ctx, id);
      if (rank !== null) node.rank = rank;
    }

    // Also process edge statements inside the subgraph
    const stmts = splitStatements(bodyText);
    const allNodeIds = new Set<string>(nodeIds);
    for (const s of stmts) {
      if (/->|--/.test(s) && !/rank\s*=/i.test(s)) {
        processEdgeStatement(s, ctx, rank);
        // Collect edge endpoint ids into the cluster's node set
        if (isCluster) {
          const chainPart = s.replace(/\[.*\]/, '');
          const parts = chainPart.split(/->|--/).map((p) => parseNodeId(p.trim())).filter(Boolean);
          for (const id of parts) allNodeIds.add(id);
        }
      }
    }

    // Register as a cluster if the name starts with "cluster"
    // C: a subgraph is a cluster iff its name begins with "cluster" (agsubg is_cluster check)
    if (isCluster && subgraphName !== null) {
      const labelMatch = /\blabel\s*=\s*(?:"([^"]*)"|(\S+))/i.exec(bodyText);
      const label = labelMatch?.[1] ?? labelMatch?.[2] ?? null;
      ctx.clusters.push({ id: subgraphName, label, nodeIds: [...allNodeIds] });
    }

    return;
  }

  // --- edge chain: id -> id -> id [attrs] or id -- id -- id [attrs] ---
  if (/->|--/.test(stmt)) {
    processEdgeStatement(stmt, ctx, null);
    return;
  }

  // --- explicit node declaration: id [attr-list] or bare id ---
  const extracted = extractAttrList(stmt);
  const idPart = extracted ? extracted.beforeAttr : stmt.trim();
  const nodeId = parseNodeId(idPart);
  if (nodeId === '') return;

  const node = ensureNode(ctx, nodeId);
  if (extracted) {
    const attrs = parseAttrList(extracted.attrContent);
    applyNodeAttrs(node, attrs);
  }
}

/**
 * Process an edge statement (handles chains and attribute lists).
 */
function processEdgeStatement(
  stmt: string,
  ctx: ParseContext,
  inheritedRank: DotNodeDef['rank'],
): void {
  const extracted = extractAttrList(stmt);
  const chainPart = extracted ? extracted.beforeAttr : stmt;
  const attrs = extracted ? parseAttrList(extracted.attrContent) : {};

  // Determine edge operator
  const isDirected = /->/.test(chainPart);

  // Split by edge operator
  const rawParts = chainPart.split(isDirected ? /->/ : /--/);
  const nodeIds = rawParts.map((p) => parseNodeId(p.trim())).filter((id) => id !== '');

  if (nodeIds.length < 2) return;

  // Edge attributes
  const label = attrs['label'] ?? null;
  const weight = attrs['weight'] !== undefined ? parseFloat(attrs['weight']) : null;
  const minLen = attrs['minlen'] !== undefined ? parseFloat(attrs['minlen']) : null;
  const rawDir = (attrs['dir'] ?? '').toLowerCase();
  const dir = (rawDir === 'forward' || rawDir === 'back' || rawDir === 'both' || rawDir === 'none')
    ? rawDir
    : undefined;
  const rawStyle = (attrs['style'] ?? '').toLowerCase();
  const edgeStyle = (rawStyle === 'dashed' || rawStyle === 'dotted' || rawStyle === 'bold')
    ? rawStyle
    : undefined;

  // Ensure all nodes exist
  for (const id of nodeIds) {
    ensureNode(ctx, id);
    if (inheritedRank !== null) {
      const node = ctx.nodes.get(id)!;
      node.rank = inheritedRank;
    }
  }

  // Create edges for consecutive pairs
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const from = nodeIds[i]!;
    const to = nodeIds[i + 1]!;
    const edge: DotEdgeDef = {
      id: `e${ctx.edgeIndex++}`,
      from,
      to,
      label: label !== null ? label : null,
      weight: weight !== null && !isNaN(weight) ? weight : null,
      minLen: minLen !== null && !isNaN(minLen) ? minLen : null,
    };
    if (dir !== undefined) edge.dir = dir;
    if (edgeStyle !== undefined) edge.edgeStyle = edgeStyle;
    ctx.edges.push(edge);
  }
}

// ---------------------------------------------------------------------------
// Strict deduplication (D3)
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseDot(source: string): DotDiagramAST {
  if (source.trim() === '') return { ...SAFE_EMPTY_AST, skinparamLines: [], nodes: [], edges: [] };

  const { dotContent, title, skinparamLines } = preprocess(source);

  const header = parseGraphHeader(dotContent);
  if (!header) {
    return { ...SAFE_EMPTY_AST, title, skinparamLines };
  }

  const body = extractBody(dotContent, header.bodyStart) ?? '';

  const ctx: ParseContext = {
    nodes: new Map<string, DotNodeDef>(),
    edges: [],
    edgeIndex: 0,
    clusters: [],
    nodeDefaults: { shape: 'ellipse' },
    rankDir: null,
    nodeSep: null,
    rankSep: null,
  };

  const stmts = splitStatements(body);
  for (const stmt of stmts) {
    processStatement(stmt, ctx);
  }

  const edges = header.strict ? deduplicateEdges(ctx.edges) : ctx.edges;

  return {
    graphType: header.graphType,
    strict: header.strict,
    name: header.name,
    title,
    rankDir: ctx.rankDir,
    nodeSep: ctx.nodeSep,
    rankSep: ctx.rankSep,
    skinparamLines,
    rawStyles: [],
    nodes: Array.from(ctx.nodes.values()),
    edges,
    clusters: ctx.clusters,
  };
}
