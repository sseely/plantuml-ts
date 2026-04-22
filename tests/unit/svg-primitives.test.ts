import { describe, it, expect } from 'vitest';
import {
  rect,
  line,
  text,
  path,
  group,
  defs,
  svgRoot,
  arrowHead,
  arrowHeadRef,
} from '../../src/core/svg.js';
import type { LineStyle, TextStyle, ArrowType } from '../../src/core/svg.js';

// ---------------------------------------------------------------------------
// rect
// ---------------------------------------------------------------------------
describe('rect', () => {
  it('returns valid SVG rect element string', () => {
    const result = rect(0, 0, 100, 50, {});
    expect(result).toMatch(/<rect x="0" y="0" width="100" height="50"/);
  });

  it('includes fill and stroke from style', () => {
    const result = rect(0, 0, 100, 50, { fill: 'white', stroke: 'black' });
    expect(result).toContain('fill="white"');
    expect(result).toContain('stroke="black"');
  });

  it('includes strokeWidth when provided', () => {
    const result = rect(0, 0, 100, 50, { strokeWidth: 2 });
    expect(result).toContain('stroke-width="2"');
  });

  it('includes strokeDasharray when provided', () => {
    const result = rect(0, 0, 100, 50, { strokeDasharray: '5,3' });
    expect(result).toContain('stroke-dasharray="5,3"');
  });

  it('includes rx for rounded corners', () => {
    const result = rect(0, 0, 100, 50, { rx: 8 });
    expect(result).toContain('rx="8"');
  });

  it('includes opacity when provided', () => {
    const result = rect(0, 0, 100, 50, { opacity: 0.5 });
    expect(result).toContain('opacity="0.5"');
  });

  it('omits optional attributes when style is empty', () => {
    const result = rect(5, 10, 200, 80, {});
    expect(result).not.toContain('fill=');
    expect(result).not.toContain('stroke=');
    expect(result).not.toContain('stroke-width=');
  });

  it('works with no style argument', () => {
    const result = rect(0, 0, 50, 50);
    expect(result).toMatch(/<rect x="0" y="0" width="50" height="50"/);
  });

  it('closes the element as a self-closing tag', () => {
    const result = rect(0, 0, 100, 50, {});
    expect(result).toMatch(/\/>$/);
  });

  it('accepts non-zero x and y', () => {
    const result = rect(10, 20, 100, 50, {});
    expect(result).toContain('x="10"');
    expect(result).toContain('y="20"');
  });
});

// ---------------------------------------------------------------------------
// line
// ---------------------------------------------------------------------------
describe('line', () => {
  it('returns valid SVG line element', () => {
    const result = line(0, 0, 100, 0, {});
    expect(result).toMatch(/<line x1="0" y1="0" x2="100" y2="0"/);
  });

  it('includes stroke from style', () => {
    const result = line(0, 0, 100, 0, { stroke: '#333' });
    expect(result).toContain('stroke="#333"');
  });

  it('includes strokeWidth when provided', () => {
    const result = line(0, 0, 100, 0, { strokeWidth: 3 });
    expect(result).toContain('stroke-width="3"');
  });

  it('includes strokeDasharray when provided', () => {
    const style: LineStyle = { strokeDasharray: '4,2' };
    const result = line(0, 0, 100, 0, style);
    expect(result).toContain('stroke-dasharray="4,2"');
  });

  it('includes markerEnd when provided', () => {
    const result = line(0, 0, 100, 0, { markerEnd: 'url(#arrow-sync)' });
    expect(result).toContain('marker-end="url(#arrow-sync)"');
  });

  it('includes markerStart when provided', () => {
    const result = line(0, 0, 100, 0, { markerStart: 'url(#arrow-found)' });
    expect(result).toContain('marker-start="url(#arrow-found)"');
  });

  it('omits optional attributes when style is empty', () => {
    const result = line(0, 0, 100, 0, {});
    expect(result).not.toContain('stroke=');
    expect(result).not.toContain('marker-end=');
  });

  it('works with no style argument', () => {
    const result = line(10, 20, 30, 40);
    expect(result).toMatch(/<line x1="10" y1="20" x2="30" y2="40"/);
  });

  it('closes as self-closing tag', () => {
    const result = line(0, 0, 10, 10, {});
    expect(result).toMatch(/\/>$/);
  });
});

// ---------------------------------------------------------------------------
// text
// ---------------------------------------------------------------------------
describe('text', () => {
  it('returns SVG text element with tspan children', () => {
    const result = text(10, 20, 'hello', {});
    expect(result).toContain('<text');
    expect(result).toContain('<tspan');
    expect(result).toContain('hello');
    expect(result).toContain('</text>');
  });

  it('sets x and y coordinates on the text element', () => {
    const result = text(15, 25, 'hi', {});
    expect(result).toContain('x="15"');
    expect(result).toContain('y="25"');
  });

  it('includes fontFamily from style', () => {
    const result = text(0, 0, 'hi', { fontFamily: 'Arial' });
    expect(result).toContain('font-family="Arial"');
  });

  it('includes fontSize from style', () => {
    const result = text(0, 0, 'hi', { fontSize: 14 });
    expect(result).toContain('font-size="14"');
  });

  it('includes fontWeight bold from style', () => {
    const result = text(0, 0, 'hi', { fontWeight: 'bold' });
    expect(result).toContain('font-weight="bold"');
  });

  it('includes fontStyle italic from style', () => {
    const result = text(0, 0, 'hi', { fontStyle: 'italic' });
    expect(result).toContain('font-style="italic"');
  });

  it('includes fill from style', () => {
    const result = text(0, 0, 'hi', { fill: 'red' });
    expect(result).toContain('fill="red"');
  });

  it('includes textAnchor from style', () => {
    const result = text(0, 0, 'hi', { textAnchor: 'middle' });
    expect(result).toContain('text-anchor="middle"');
  });

  it('works with no style argument', () => {
    const result = text(0, 0, 'hello');
    expect(result).toContain('<text');
    expect(result).toContain('hello');
  });

  it('escapes XML special characters in content', () => {
    const result = text(0, 0, 'a < b & c > d');
    expect(result).toContain('&lt;');
    expect(result).toContain('&amp;');
    expect(result).toContain('&gt;');
  });

  it('omits optional style attributes when style is empty', () => {
    const style: TextStyle = {};
    const result = text(0, 0, 'hi', style);
    expect(result).not.toContain('font-family=');
    expect(result).not.toContain('font-size=');
    expect(result).not.toContain('font-weight=');
  });
});

// ---------------------------------------------------------------------------
// path
// ---------------------------------------------------------------------------
describe('path', () => {
  it('returns SVG path element', () => {
    const result = path('M 0 0 L 100 100', {});
    expect(result).toMatch(/<path d="M 0 0 L 100 100"/);
  });

  it('includes stroke from style', () => {
    const result = path('M 0 0', { stroke: 'blue' });
    expect(result).toContain('stroke="blue"');
  });

  it('includes strokeDasharray when provided', () => {
    const result = path('M 0 0', { strokeDasharray: '6,3' });
    expect(result).toContain('stroke-dasharray="6,3"');
  });

  it('includes markerEnd when provided', () => {
    const result = path('M 0 0 L 10 10', { markerEnd: 'url(#arrow-async)' });
    expect(result).toContain('marker-end="url(#arrow-async)"');
  });

  it('closes as self-closing tag', () => {
    const result = path('M 0 0 L 100 100', {});
    expect(result).toMatch(/\/>$/);
  });

  it('works with no style argument', () => {
    const result = path('M 0 0 L 50 50');
    expect(result).toContain('d="M 0 0 L 50 50"');
  });
});

// ---------------------------------------------------------------------------
// group
// ---------------------------------------------------------------------------
describe('group', () => {
  it('wraps children in SVG g element with id', () => {
    const result = group('grp', ['<line/>']);
    expect(result).toBe('<g id="grp"><line/></g>');
  });

  it('concatenates multiple children', () => {
    const result = group('g1', ['<rect/>', '<line/>']);
    expect(result).toBe('<g id="g1"><rect/><line/></g>');
  });

  it('handles empty children array', () => {
    const result = group('empty', []);
    expect(result).toBe('<g id="empty"></g>');
  });

  it('accepts nested group strings', () => {
    const inner = group('inner', ['<circle/>']);
    const outer = group('outer', [inner]);
    expect(outer).toBe('<g id="outer"><g id="inner"><circle/></g></g>');
  });
});

// ---------------------------------------------------------------------------
// defs
// ---------------------------------------------------------------------------
describe('defs', () => {
  it('wraps children in a defs element', () => {
    const result = defs(['<marker id="m1"/>']);
    expect(result).toBe('<defs><marker id="m1"/></defs>');
  });

  it('concatenates multiple children', () => {
    const result = defs(['<marker id="m1"/>', '<marker id="m2"/>']);
    expect(result).toBe('<defs><marker id="m1"/><marker id="m2"/></defs>');
  });

  it('handles empty children array', () => {
    const result = defs([]);
    expect(result).toBe('<defs></defs>');
  });
});

// ---------------------------------------------------------------------------
// svgRoot
// ---------------------------------------------------------------------------
describe('svgRoot', () => {
  it('starts with svg element with xmlns', () => {
    const result = svgRoot(400, 300, []);
    expect(result).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it('ends with closing svg tag', () => {
    const result = svgRoot(400, 300, []);
    expect(result).toMatch(/<\/svg>$/);
  });

  it('includes correct width and height attributes', () => {
    const result = svgRoot(400, 300, []);
    expect(result).toContain('width="400"');
    expect(result).toContain('height="300"');
  });

  it('includes viewBox attribute', () => {
    const result = svgRoot(400, 300, []);
    expect(result).toContain('viewBox="0 0 400 300"');
  });

  it('contains defs with all arrow markers', () => {
    const result = svgRoot(400, 300, []);
    expect(result).toContain('<defs>');
    expect(result).toContain('<marker');
  });

  it('embeds all ArrowType markers in defs', () => {
    const result = svgRoot(400, 300, []);
    const arrowTypes: ArrowType[] = [
      'sync', 'async', 'reply', 'replyAsync',
      'extension', 'implementation',
      'composition', 'aggregation',
      'dependency', 'lost', 'found',
    ];
    for (const t of arrowTypes) {
      expect(result).toContain(`id="${arrowHeadRef(t)}"`);
    }
  });

  it('includes children content in output', () => {
    const result = svgRoot(400, 300, ['<rect x="0" y="0" width="10" height="10"/>']);
    expect(result).toContain('<rect x="0" y="0"');
  });

  it('wraps all content correctly (starts svg, has defs, has children, ends svg)', () => {
    const result = svgRoot(200, 100, ['<line x1="0" y1="0" x2="10" y2="10"/>']);
    expect(result.startsWith('<svg')).toBe(true);
    expect(result.endsWith('</svg>')).toBe(true);
    expect(result).toContain('<defs>');
    expect(result).toContain('<line');
  });
});

// ---------------------------------------------------------------------------
// arrowHead
// ---------------------------------------------------------------------------
describe('arrowHead', () => {
  it('returns marker element for sync type with filled polygon', () => {
    const result = arrowHead('sync');
    expect(result).toContain('<marker');
    expect(result).toContain('<polygon');
    // Filled: must have a non-empty fill (not "none")
    expect(result).toMatch(/fill="(?!none)[^"]+"/);
    expect(result).toContain('</marker>');
  });

  it('returns marker element for async type with open arrowhead', () => {
    const result = arrowHead('async');
    expect(result).toContain('<marker');
    // async is open — fill should be "none" or the element uses polyline/path without fill
    expect(result).toContain('</marker>');
  });

  it('reply marker is identical shape to sync (dashes are on the line)', () => {
    const reply = arrowHead('reply');
    const sync = arrowHead('sync');
    expect(reply).toContain('<polygon');
    expect(sync).toContain('<polygon');
    // Both should have a non-none fill (the dashed style is on the line, not the marker)
    expect(reply).toMatch(/fill="(?!none)[^"]+"/);
  });

  it('replyAsync marker has open arrowhead shape', () => {
    const result = arrowHead('replyAsync');
    expect(result).toContain('<marker');
    expect(result).toContain('</marker>');
  });

  it('extension marker has hollow triangle', () => {
    const result = arrowHead('extension');
    expect(result).toContain('<marker');
    expect(result).toContain('<polygon');
    // Hollow: fill must be none or white
    expect(result).toMatch(/fill="(none|white)"/);
  });

  it('implementation marker has hollow triangle (dashed line variant)', () => {
    const result = arrowHead('implementation');
    expect(result).toContain('<marker');
    expect(result).toContain('<polygon');
    expect(result).toMatch(/fill="(none|white)"/);
  });

  it('composition marker has filled diamond', () => {
    const result = arrowHead('composition');
    expect(result).toContain('<marker');
    expect(result).toContain('<polygon');
    expect(result).toMatch(/fill="(?!none)[^"]+"/);
  });

  it('aggregation marker has hollow diamond', () => {
    const result = arrowHead('aggregation');
    expect(result).toContain('<marker');
    expect(result).toContain('<polygon');
    expect(result).toMatch(/fill="(none|white)"/);
  });

  it('dependency marker contains an arrowhead shape', () => {
    const result = arrowHead('dependency');
    expect(result).toContain('<marker');
    expect(result).toContain('</marker>');
  });

  it('lost marker has circle shape', () => {
    const result = arrowHead('lost');
    expect(result).toContain('<marker');
    expect(result).toContain('<circle');
    expect(result).toContain('</marker>');
  });

  it('found marker has circle shape', () => {
    const result = arrowHead('found');
    expect(result).toContain('<marker');
    expect(result).toContain('<circle');
    expect(result).toContain('</marker>');
  });

  it('every marker has a non-empty id attribute', () => {
    const types: ArrowType[] = [
      'sync', 'async', 'reply', 'replyAsync',
      'extension', 'implementation',
      'composition', 'aggregation',
      'dependency', 'lost', 'found',
    ];
    for (const t of types) {
      const result = arrowHead(t);
      expect(result).toMatch(/id="[^"]+"/);
    }
  });

  it('each marker id matches arrowHeadRef output', () => {
    const types: ArrowType[] = [
      'sync', 'async', 'reply', 'replyAsync',
      'extension', 'implementation',
      'composition', 'aggregation',
      'dependency', 'lost', 'found',
    ];
    for (const t of types) {
      const marker = arrowHead(t);
      const ref = arrowHeadRef(t);
      expect(marker).toContain(`id="${ref}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// arrowHeadRef
// ---------------------------------------------------------------------------
describe('arrowHeadRef', () => {
  it('returns a non-empty string for each ArrowType', () => {
    const types: ArrowType[] = [
      'sync', 'async', 'reply', 'replyAsync',
      'extension', 'implementation',
      'composition', 'aggregation',
      'dependency', 'lost', 'found',
    ];
    for (const t of types) {
      expect(arrowHeadRef(t)).toBeTruthy();
    }
  });

  it('returns distinct ids for distinct types', () => {
    const types: ArrowType[] = [
      'sync', 'async', 'reply', 'replyAsync',
      'extension', 'implementation',
      'composition', 'aggregation',
      'dependency', 'lost', 'found',
    ];
    const refs = types.map((t) => arrowHeadRef(t));
    const unique = new Set(refs);
    expect(unique.size).toBe(types.length);
  });

  it('returns a string usable in a url() reference', () => {
    // The id should be a valid XML id (no spaces, starts with letter or _)
    const result = arrowHeadRef('sync');
    expect(result).toMatch(/^[a-zA-Z_][a-zA-Z0-9_-]*$/);
  });
});
