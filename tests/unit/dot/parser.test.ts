import { describe, it, expect } from 'vitest';
import { parseDot } from '../../../src/diagrams/dot/parser.js';
import { extractBlocks } from '../../../src/core/block-extractor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrap(inner: string): string {
  return `@startdot\n${inner}\n@enddot`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseDot', () => {
  // -------------------------------------------------------------------------
  // 1. Basic digraph
  // -------------------------------------------------------------------------
  it('basic digraph: 2 nodes, 1 directed edge, graphType=digraph', () => {
    const ast = parseDot(wrap('digraph G { a -> b }'));
    expect(ast.graphType).toBe('digraph');
    expect(ast.nodes).toHaveLength(2);
    expect(ast.edges).toHaveLength(1);
    expect(ast.edges[0]!.from).toBe('a');
    expect(ast.edges[0]!.to).toBe('b');
    expect(ast.edges[0]!.id).toBe('e0');
  });

  // -------------------------------------------------------------------------
  // 2. Basic undirected graph
  // -------------------------------------------------------------------------
  it('basic undirected graph: a -- b -- c → 3 nodes, 2 edges, graphType=graph', () => {
    const ast = parseDot(wrap('graph G { a -- b -- c }'));
    expect(ast.graphType).toBe('graph');
    expect(ast.nodes).toHaveLength(3);
    expect(ast.edges).toHaveLength(2);
    expect(ast.edges[0]!.from).toBe('a');
    expect(ast.edges[0]!.to).toBe('b');
    expect(ast.edges[1]!.from).toBe('b');
    expect(ast.edges[1]!.to).toBe('c');
  });

  // -------------------------------------------------------------------------
  // 3. Strict deduplication
  // -------------------------------------------------------------------------
  it('strict digraph deduplicates edges by (from, to): 3x a->b → 1 edge', () => {
    const ast = parseDot(wrap('strict digraph { a->b; a->b; a->b }'));
    expect(ast.strict).toBe(true);
    expect(ast.edges).toHaveLength(1);
    expect(ast.edges[0]!.from).toBe('a');
    expect(ast.edges[0]!.to).toBe('b');
  });

  // -------------------------------------------------------------------------
  // 4. Default node attributes
  // -------------------------------------------------------------------------
  it('node [shape=box] sets default shape for subsequent nodes', () => {
    const ast = parseDot(wrap('digraph { node [shape=box]; a }'));
    const a = ast.nodes.find((n) => n.id === 'a');
    expect(a).toBeDefined();
    expect(a!.shape).toBe('box');
  });

  // -------------------------------------------------------------------------
  // 5. Subgraph rank
  // -------------------------------------------------------------------------
  it('subgraph rank=same applies to all node ids in subgraph body', () => {
    const src = wrap('digraph G { subgraph { rank=same; x; y } }');
    const ast = parseDot(src);
    const x = ast.nodes.find((n) => n.id === 'x');
    const y = ast.nodes.find((n) => n.id === 'y');
    expect(x).toBeDefined();
    expect(y).toBeDefined();
    expect(x!.rank).toBe('same');
    expect(y!.rank).toBe('same');
  });

  // -------------------------------------------------------------------------
  // 6. Title extraction
  // -------------------------------------------------------------------------
  it('title line is extracted into ast.title and not treated as a node', () => {
    const src = `@startdot\ntitle My Diagram\ndigraph G { a -> b }\n@enddot`;
    const ast = parseDot(src);
    expect(ast.title).toBe('My Diagram');
    // title line should not create a node named 'title'
    expect(ast.nodes.find((n) => n.id === 'title')).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 7. Skinparam collection
  // -------------------------------------------------------------------------
  it('skinparam lines are collected into skinparamLines array', () => {
    const src = `@startdot\nskinparam backgroundColor #FEFEFE\ndigraph { a }\n@enddot`;
    const ast = parseDot(src);
    expect(ast.skinparamLines).toHaveLength(1);
    expect(ast.skinparamLines[0]).toContain('backgroundColor');
  });

  // -------------------------------------------------------------------------
  // 8. Comment stripping
  // -------------------------------------------------------------------------
  it('line comments (//) and block comments (/* */) are stripped', () => {
    const src = wrap(`digraph G {
  // this is a comment
  a -> b /* inline comment */
  /* block
     comment */
  c
}`);
    const ast = parseDot(src);
    expect(ast.nodes.find((n) => n.id === 'a')).toBeDefined();
    expect(ast.nodes.find((n) => n.id === 'b')).toBeDefined();
    expect(ast.nodes.find((n) => n.id === 'c')).toBeDefined();
    // Ensure comment text doesn't leak as a node id
    expect(ast.nodes.find((n) => n.id.includes('comment'))).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 9. Corpus fixture 1
  // -------------------------------------------------------------------------
  it('corpus fixture 1: digraph toto { azerty; } → 1 node, 0 edges', () => {
    const ast = parseDot(wrap('digraph toto { azerty; }'));
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]!.id).toBe('azerty');
    expect(ast.edges).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 10. Corpus fixture 2
  // -------------------------------------------------------------------------
  it('corpus fixture 2: graph graphname { a -- b -- c; b -- d; } → 4 nodes, 3 edges', () => {
    const ast = parseDot(wrap('graph graphname { a -- b -- c; b -- d; }'));
    expect(ast.nodes).toHaveLength(4);
    expect(ast.edges).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // 11. Quoted identifiers
  // -------------------------------------------------------------------------
  it('quoted identifiers: "my node" -> "other" → ids are `my node` and `other`', () => {
    const ast = parseDot(wrap('digraph { "my node" -> "other" }'));
    expect(ast.nodes.find((n) => n.id === 'my node')).toBeDefined();
    expect(ast.nodes.find((n) => n.id === 'other')).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 12. HTML label stripping
  //
  // Parsing is delegated to graphviz-ts's DOT grammar, so HTML labels use
  // standard DOT syntax: <<...>> (angle-delimited) or a quoted "<...>". Tags
  // are stripped to plain text. The old hand-parser also accepted the bare,
  // delimiter-less form `label=<b>Bold</b>`, but the oracle (real PlantUML)
  // rejects that as a syntax error — see the error-propagation test below — so
  // dropping that leniency is the more faithful behavior.
  // -------------------------------------------------------------------------
  it('HTML label <<b>Bold</b>> is stripped to `Bold`', () => {
    const ast = parseDot(wrap('digraph { a [label=<<b>Bold</b>>] }'));
    expect(ast.nodes.find((n) => n.id === 'a')?.label).toBe('Bold');
  });

  it('quoted HTML-ish label "<b>Bold</b>" is stripped to `Bold`', () => {
    const ast = parseDot(wrap('digraph { a [label="<b>Bold</b>"] }'));
    expect(ast.nodes.find((n) => n.id === 'a')?.label).toBe('Bold');
  });

  // -------------------------------------------------------------------------
  // 12b. Invalid DOT is surfaced up (PlantUML feeds DOT to graphviz and
  // reports its failures rather than silently producing nothing).
  // -------------------------------------------------------------------------
  it('throws on malformed DOT instead of swallowing it', () => {
    expect(() => parseDot(wrap('digraph { a -> }'))).toThrow(/could not parse DOT/);
  });

  // -------------------------------------------------------------------------
  // 13. Edge with attributes
  // -------------------------------------------------------------------------
  it('edge with label and weight attrs are parsed correctly', () => {
    const ast = parseDot(wrap('digraph { a -> b [label="edge label", weight=2] }'));
    expect(ast.edges).toHaveLength(1);
    expect(ast.edges[0]!.label).toBe('edge label');
    expect(ast.edges[0]!.weight).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 14. Implicit nodes from edges
  // -------------------------------------------------------------------------
  it('implicit nodes: a->b with no explicit node stmts → both in nodes array', () => {
    const ast = parseDot(wrap('digraph { a -> b }'));
    const ids = ast.nodes.map((n) => n.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ast.nodes.find((n) => n.id === 'a')!.shape).toBe('ellipse');
    expect(ast.nodes.find((n) => n.id === 'b')!.shape).toBe('ellipse');
  });

  // -------------------------------------------------------------------------
  // 15. Empty input
  // -------------------------------------------------------------------------
  it('empty @startdot/@enddot block returns safe empty AST without throwing', () => {
    expect(() => parseDot('@startdot\n@enddot')).not.toThrow();
    const ast = parseDot('@startdot\n@enddot');
    expect(ast.nodes).toHaveLength(0);
    expect(ast.edges).toHaveLength(0);
    expect(ast.graphType).toBe('digraph');
  });

  // -------------------------------------------------------------------------
  // 16. rankdir extraction
  // -------------------------------------------------------------------------
  it('graph [rankdir=LR] sets ast.rankDir to LR', () => {
    const ast = parseDot(wrap('digraph { graph [rankdir=LR] }'));
    expect(ast.rankDir).toBe('LR');
  });

  // -------------------------------------------------------------------------
  // 17. Node with width/height
  // -------------------------------------------------------------------------
  it('node [width=2.0, height=1.0] sets widthIn and heightIn', () => {
    const ast = parseDot(wrap('digraph { a [width=2.0, height=1.0] }'));
    const a = ast.nodes.find((n) => n.id === 'a');
    expect(a).toBeDefined();
    expect(a!.widthIn).toBe(2.0);
    expect(a!.heightIn).toBe(1.0);
  });

  // -------------------------------------------------------------------------
  // Additional coverage tests
  // -------------------------------------------------------------------------

  it('completely empty string returns safe empty AST without throwing', () => {
    expect(() => parseDot('')).not.toThrow();
    const ast = parseDot('');
    expect(ast.nodes).toHaveLength(0);
    expect(ast.edges).toHaveLength(0);
  });

  it('graph name is parsed when present', () => {
    const ast = parseDot(wrap('digraph MyGraph { }'));
    expect(ast.name).toBe('MyGraph');
  });

  it('graph name is null when absent', () => {
    const ast = parseDot(wrap('digraph { }'));
    expect(ast.name).toBeNull();
  });

  it('strict flag is false for non-strict graph', () => {
    const ast = parseDot(wrap('digraph G { a -> b }'));
    expect(ast.strict).toBe(false);
  });

  it('shape normalisation: rect → box, rectangle → box', () => {
    const ast = parseDot(wrap('digraph { a [shape=rect]; b [shape=rectangle] }'));
    expect(ast.nodes.find((n) => n.id === 'a')!.shape).toBe('box');
    expect(ast.nodes.find((n) => n.id === 'b')!.shape).toBe('box');
  });

  it('shape normalisation: none → plaintext', () => {
    const ast = parseDot(wrap('digraph { a [shape=none] }'));
    expect(ast.nodes.find((n) => n.id === 'a')!.shape).toBe('plaintext');
  });

  it('shape normalisation: unknown shape → ellipse', () => {
    const ast = parseDot(wrap('digraph { a [shape=hexagon] }'));
    expect(ast.nodes.find((n) => n.id === 'a')!.shape).toBe('ellipse');
  });

  it('default node label equals node id', () => {
    const ast = parseDot(wrap('digraph { mynode }'));
    const n = ast.nodes.find((node) => node.id === 'mynode');
    expect(n).toBeDefined();
    expect(n!.label).toBe('mynode');
  });

  it('explicit label overrides default id label', () => {
    const ast = parseDot(wrap('digraph { a [label="Custom Label"] }'));
    const a = ast.nodes.find((n) => n.id === 'a');
    expect(a!.label).toBe('Custom Label');
  });

  it('edge id sequence is e0, e1, e2', () => {
    const ast = parseDot(wrap('digraph { a->b; b->c; c->d }'));
    expect(ast.edges.map((e) => e.id)).toEqual(['e0', 'e1', 'e2']);
  });

  it('widthIn and heightIn are null by default', () => {
    const ast = parseDot(wrap('digraph { a }'));
    const a = ast.nodes.find((n) => n.id === 'a');
    expect(a!.widthIn).toBeNull();
    expect(a!.heightIn).toBeNull();
  });

  it('rank is null by default', () => {
    const ast = parseDot(wrap('digraph { a }'));
    expect(ast.nodes[0]!.rank).toBeNull();
  });

  it('nodesep extraction from graph attrs', () => {
    const ast = parseDot(wrap('digraph { graph [nodesep=0.5] }'));
    expect(ast.nodeSep).toBe(0.5);
  });

  it('ranksep extraction from graph attrs', () => {
    const ast = parseDot(wrap('digraph { graph [ranksep=1.5] }'));
    expect(ast.rankSep).toBe(1.5);
  });

  it('no extra nodes created from comment content', () => {
    const ast = parseDot(wrap('digraph { /* nothing */ }'));
    expect(ast.nodes).toHaveLength(0);
  });

  it('multiple skinparam lines are all collected', () => {
    const src = `@startdot\nskinparam A 1\nskinparam B 2\ndigraph { }\n@enddot`;
    const ast = parseDot(src);
    expect(ast.skinparamLines).toHaveLength(2);
  });

  it('non-strict graph does not deduplicate edges', () => {
    const ast = parseDot(wrap('digraph { a->b; a->b }'));
    expect(ast.strict).toBe(false);
    expect(ast.edges).toHaveLength(2);
  });

  it('subgraph rank=source applies source rank', () => {
    const ast = parseDot(wrap('digraph { subgraph { rank=source; s } }'));
    const s = ast.nodes.find((n) => n.id === 's');
    expect(s!.rank).toBe('source');
  });

  it('subgraph rank=sink applies sink rank', () => {
    const ast = parseDot(wrap('digraph { subgraph { rank=sink; t } }'));
    const t = ast.nodes.find((n) => n.id === 't');
    expect(t!.rank).toBe('sink');
  });

  it('subgraph rank=min applies min rank', () => {
    const ast = parseDot(wrap('digraph { subgraph { rank=min; m } }'));
    const m = ast.nodes.find((n) => n.id === 'm');
    expect(m!.rank).toBe('min');
  });

  it('subgraph rank=max applies max rank', () => {
    const ast = parseDot(wrap('digraph { subgraph { rank=max; mx } }'));
    const mx = ast.nodes.find((n) => n.id === 'mx');
    expect(mx!.rank).toBe('max');
  });

  it('node defaults apply to implicitly-created nodes in edges', () => {
    const ast = parseDot(wrap('digraph { node [shape=diamond]; a -> b }'));
    expect(ast.nodes.find((n) => n.id === 'a')!.shape).toBe('diamond');
    expect(ast.nodes.find((n) => n.id === 'b')!.shape).toBe('diamond');
  });

  it('explicit node after default overrides shape with its own attrs', () => {
    const ast = parseDot(wrap('digraph { node [shape=box]; a [shape=circle] }'));
    expect(ast.nodes.find((n) => n.id === 'a')!.shape).toBe('circle');
  });

  it('edge minlen attribute is parsed', () => {
    const ast = parseDot(wrap('digraph { a -> b [minlen=3] }'));
    expect(ast.edges[0]!.minLen).toBe(3);
  });

  it('title without @startdot wrapper is still extracted', () => {
    const ast = parseDot('title Bare Title\ndigraph { a }');
    expect(ast.title).toBe('Bare Title');
  });

  it('rankDir is null when no rankdir attr present', () => {
    const ast = parseDot(wrap('digraph { a -> b }'));
    expect(ast.rankDir).toBeNull();
  });

  it('rankDir TB is parsed', () => {
    const ast = parseDot(wrap('digraph { graph [rankdir=TB] }'));
    expect(ast.rankDir).toBe('TB');
  });

  it('rankDir BT is parsed', () => {
    const ast = parseDot(wrap('digraph { graph [rankdir=BT] }'));
    expect(ast.rankDir).toBe('BT');
  });

  it('rankDir RL is parsed', () => {
    const ast = parseDot(wrap('digraph { graph [rankdir=RL] }'));
    expect(ast.rankDir).toBe('RL');
  });

  it('graph type: undirected graph keyword produces graphType=graph', () => {
    const ast = parseDot(wrap('graph { a -- b }'));
    expect(ast.graphType).toBe('graph');
  });

  it('skinparamLines is empty array when no skinparam lines', () => {
    const ast = parseDot(wrap('digraph { }'));
    expect(ast.skinparamLines).toEqual([]);
  });

  it('block extractor: @startdot produces type=dot', () => {
    const blocks = extractBlocks(['@startdot', 'digraph { a }', '@enddot']);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe('dot');
  });
});
