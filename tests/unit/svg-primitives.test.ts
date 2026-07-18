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
  ellipse,
  diamond,
  linkWrap,
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
    // G1c: plain-string Paint values are resolved to their canonical jar
    // hex via paintToSvg (white -> #FFFFFF, black -> #000000).
    const result = rect(0, 0, 100, 50, { fill: 'white', stroke: 'black' });
    expect(result).toContain('fill="#FFFFFF"');
    expect(result).toContain('stroke="#000000"');
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
    // G1c: a 3-digit hex expands to the canonical 6-digit form (HColorSet
    // parseSimpleColor's 3-digit branch, java:134-143).
    const result = line(0, 0, 100, 0, { stroke: '#333' });
    expect(result).toContain('stroke="#333333"');
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
  it('returns SVG text element with plain (un-tspan-wrapped) content (G2 N4)', () => {
    // jar never wraps a single-run label in <tspan> -- see text()'s own
    // doc comment, plans/g2-class-svg/ledger.md N4.
    const result = text(10, 20, 'hello', {});
    expect(result).toBe('<text x="10" y="20">hello</text>');
    expect(result).not.toContain('<tspan');
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

  it('swaps embedded double-quotes in fontFamily for single-quotes (G2 N12)', () => {
    // `skinparam defaultFontName "Liberation Mono"` retains its raw quotes
    // in the theme's fontFamily value (mirrors upstream's own
    // FontStack#fullDefinition); attrs() does no XML escaping, so a literal
    // `"` inside the `"`-delimited attribute would produce malformed XML.
    // Upstream's own SVG writer (FontStack#getSvgFamily) resolves this by
    // swapping `"` for `'`, jar-verified (tipude-10-tizi427).
    const result = text(0, 0, 'hi', { fontFamily: '"Liberation Mono"' });
    expect(result).toContain(`font-family="'Liberation Mono'"`);
    expect(result).not.toContain('font-family=""Liberation Mono""');
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
    // G1c: named colors resolve to their canonical jar hex.
    const result = text(0, 0, 'hi', { fill: 'red' });
    expect(result).toContain('fill="#FF0000"');
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
    // G1c: named colors resolve to their canonical jar hex.
    const result = path('M 0 0', { stroke: 'blue' });
    expect(result).toContain('stroke="#0000FF"');
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

  it('defaults to fill="none" when fill is omitted (every pre-existing caller)', () => {
    const result = path('M 0 0', { stroke: 'red' });
    expect(result).toContain('fill="none"');
  });

  it('G2/N13: emits the given fill when provided (the note-outline path needs a real background)', () => {
    const result = path('M 0 0', { fill: '#FEFFDD', stroke: 'red' });
    expect(result).toContain('fill="#FEFFDD"');
    expect(result).not.toContain('fill="none"');
  });

  it('resolves a named fill color to its canonical jar hex, same as stroke', () => {
    const result = path('M 0 0', { fill: 'blue' });
    expect(result).toContain('fill="#0000FF"');
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

  // New overload: group(children: string, attrs?: SvgAttrs)
  it('wraps a child string in a g element with SvgAttrs', () => {
    const result = group('<rect/>', { transform: 'translate(10,20)' });
    expect(result).toBe('<g transform="translate(10,20)"><rect/></g>');
  });

  it('wraps a child string in a g element with no attrs', () => {
    const result = group('<rect/>');
    expect(result).toBe('<g><rect/></g>');
  });

  it('applies multiple SvgAttrs to the g element', () => {
    const result = group('<circle/>', { id: 'myGroup', opacity: '0.5' });
    expect(result).toContain('id="myGroup"');
    expect(result).toContain('opacity="0.5"');
    expect(result).toContain('<circle/>');
  });
});

describe('linkWrap (G2 N15)', () => {
  it('emits the jar-verified attribute set/order, target defaulting to _top', () => {
    const result = linkWrap('<rect/>', { url: 'http://x.com', tooltip: 'a tip' });
    expect(result).toBe(
      '<a target="_top" href="http://x.com" xlink:href="http://x.com" xlink:type="simple" ' +
        'xlink:actuate="onRequest" xlink:show="new" title="a tip" xlink:title="a tip"><rect/></a>',
    );
  });

  it('accepts an explicit target override', () => {
    const result = linkWrap('<rect/>', { url: 'http://x.com', tooltip: 'x' }, '_blank');
    expect(result).toContain('target="_blank"');
  });

  it('XML-escapes the href/title values', () => {
    const result = linkWrap('<rect/>', { url: 'http://x.com?a=1&b=2', tooltip: 'a "tip"' });
    expect(result).toContain('href="http://x.com?a=1&amp;b=2"');
    expect(result).toContain('title="a &quot;tip&quot;"');
  });

  it('omits undefined SvgAttrs values', () => {
    const result = group('<rect/>', { fill: undefined, stroke: 'red' });
    expect(result).not.toContain('fill=');
    expect(result).toContain('stroke="red"');
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
// ellipse
// ---------------------------------------------------------------------------
describe('ellipse', () => {
  it('returns an SVG ellipse element with cx, cy, rx, ry', () => {
    const result = ellipse(50, 50, 30, 20);
    expect(result).toContain('<ellipse');
    expect(result).toContain('cx="50"');
    expect(result).toContain('cy="50"');
    expect(result).toContain('rx="30"');
    expect(result).toContain('ry="20"');
    expect(result).toMatch(/\/>$/);
  });

  it('includes extra attrs when provided', () => {
    const result = ellipse(50, 50, 30, 20, { fill: '#fff' });
    expect(result).toContain('cx="50"');
    expect(result).toContain('cy="50"');
    expect(result).toContain('rx="30"');
    expect(result).toContain('ry="20"');
    expect(result).toContain('fill="#fff"');
    expect(result).toContain('<ellipse');
  });

  it('omits optional attrs when none provided', () => {
    const result = ellipse(10, 20, 5, 3);
    expect(result).not.toContain('fill=');
    expect(result).not.toContain('stroke=');
  });

  it('closes as a self-closing tag', () => {
    const result = ellipse(0, 0, 10, 5);
    expect(result).toMatch(/\/>$/);
  });

  it('includes multiple extra attrs', () => {
    const result = ellipse(0, 0, 10, 5, { fill: 'red', stroke: 'blue' });
    expect(result).toContain('fill="red"');
    expect(result).toContain('stroke="blue"');
  });

  it('omits undefined values from extra attrs', () => {
    const result = ellipse(0, 0, 10, 5, { fill: undefined, stroke: 'black' });
    expect(result).not.toContain('fill=');
    expect(result).toContain('stroke="black"');
  });
});

// ---------------------------------------------------------------------------
// diamond
// ---------------------------------------------------------------------------
describe('diamond', () => {
  it('returns a polygon element', () => {
    const result = diamond(40, 40, 10);
    expect(result).toContain('<polygon');
    expect(result).toMatch(/\/>$/);
  });

  it('computes correct four-point polygon for diamond(40, 40, 10)', () => {
    const result = diamond(40, 40, 10);
    expect(result).toContain('points="40,30 50,40 40,50 30,40"');
  });

  it('top point is (cx, cy - size)', () => {
    const result = diamond(40, 40, 10);
    // top = (40, 30)
    expect(result).toContain('40,30');
  });

  it('right point is (cx + size, cy)', () => {
    const result = diamond(40, 40, 10);
    // right = (50, 40)
    expect(result).toContain('50,40');
  });

  it('bottom point is (cx, cy + size)', () => {
    const result = diamond(40, 40, 10);
    // bottom = (40, 50)
    expect(result).toContain('40,50');
  });

  it('left point is (cx - size, cy)', () => {
    const result = diamond(40, 40, 10);
    // left = (30, 40)
    expect(result).toContain('30,40');
  });

  it('includes fill attr from extra attrs', () => {
    const result = diamond(40, 40, 10, { fill: '#000' });
    expect(result).toContain('fill="#000"');
    expect(result).toContain('points="40,30 50,40 40,50 30,40"');
  });

  it('omits optional attrs when none provided', () => {
    const result = diamond(0, 0, 5);
    expect(result).not.toContain('fill=');
    expect(result).not.toContain('stroke=');
  });

  it('omits undefined values from extra attrs', () => {
    const result = diamond(0, 0, 5, { fill: undefined, stroke: 'green' });
    expect(result).not.toContain('fill=');
    expect(result).toContain('stroke="green"');
  });

  it('works with non-integer coordinates', () => {
    const result = diamond(10, 10, 5);
    expect(result).toContain('points="10,5 15,10 10,15 5,10"');
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

  it('emits a background fill rect for solid bgColor', () => {
    const result = svgRoot(400, 300, [], '#0B58A8');
    expect(result).toContain('<rect width="400" height="300" fill="#0B58A8"/>');
  });

  it('emits a background fill rect for the default white bgColor', () => {
    const result = svgRoot(400, 300, []);
    expect(result).toContain('<rect width="400" height="300" fill="#FFFFFF"/>');
  });

  it('does not emit a background rect for transparent bgColor', () => {
    const result = svgRoot(400, 300, [], 'transparent');
    // No background rect for transparent
    const bodyStart = result.indexOf('</defs>');
    const body = result.slice(bodyStart);
    expect(body).not.toContain('<rect');
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
    // Hollow: filled with background color (#FFFFFF default) to mask edge line inside shape
    expect(result).toContain('fill="#FFFFFF"');
  });

  it('extension marker respects custom bgColor', () => {
    const result = arrowHead('extension', '#1E1E1E');
    expect(result).toContain('fill="#1E1E1E"');
  });

  it('implementation marker has hollow triangle (dashed line variant)', () => {
    const result = arrowHead('implementation');
    expect(result).toContain('<marker');
    expect(result).toContain('<polygon');
    expect(result).toContain('fill="#FFFFFF"');
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
    // Hollow: filled with background color to mask edge line inside shape
    expect(result).toContain('fill="#FFFFFF"');
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

// ---------------------------------------------------------------------------
// Paint / gradient support (T2)
// ---------------------------------------------------------------------------
describe('Paint gradient support', () => {
  const grad = { color1: '#c3d8f4', color2: '#6192d1', policy: '\\' } as const;

  it('rect with a Gradient fill emits a linearGradient and url() fill (AC1)', () => {
    const out = rect(0, 0, 10, 10, { fill: grad });
    expect(out).toContain('<linearGradient');
    expect(out).toMatch(/fill="url\(#g[0-9a-z]+\)"/);
    // The def is emitted inline before the <rect>.
    expect(out.indexOf('<linearGradient')).toBeLessThan(out.indexOf('<rect'));
  });

  it('rect with a plain string fill resolves to canonical hex (G1c; AC2 pre-G1c was raw pass-through)', () => {
    expect(rect(0, 0, 100, 50, { fill: 'white', stroke: 'black' })).toBe(
      '<rect x="0" y="0" width="100" height="50" fill="#FFFFFF" stroke="#000000"/>',
    );
    // No gradient machinery leaks in for string input.
    expect(rect(0, 0, 100, 50, { fill: 'white' })).not.toContain('linearGradient');
  });

  it('dedupes an identical gradient shared by two shapes within svgRoot (AC3)', () => {
    const a = rect(0, 0, 10, 10, { fill: grad });
    const b = rect(20, 0, 10, 10, { fill: grad });
    const svg = svgRoot(100, 100, [a, b]);
    const defs = svg.match(/<linearGradient/g) ?? [];
    expect(defs).toHaveLength(1);
    // Both rects still reference the surviving def id.
    const id = (svg.match(/<linearGradient id="(g[0-9a-z]+)"/) ?? [])[1];
    expect(svg.match(new RegExp(`url\\(#${id}\\)`, 'g'))).toHaveLength(2);
  });

  it('keeps distinct gradients as separate defs', () => {
    const a = rect(0, 0, 10, 10, { fill: grad });
    const b = rect(20, 0, 10, 10, {
      fill: { color1: '#000000', color2: '#ffffff', policy: '-' },
    });
    const svg = svgRoot(100, 100, [a, b]);
    expect(svg.match(/<linearGradient/g)).toHaveLength(2);
  });

  it('resolves a Gradient in ellipse free-form extraAttrs', () => {
    const out = ellipse(5, 5, 4, 3, { fill: grad, stroke: '#111' });
    expect(out).toContain('<linearGradient');
    expect(out).toMatch(/fill="url\(#g[0-9a-z]+\)"/);
    expect(out).toContain('stroke="#111"');
  });

  it('threads a Gradient stroke through line and prepends its def', () => {
    const out = line(0, 0, 10, 10, { stroke: grad });
    // '<line ' (trailing space) avoids matching the '<linearGradient' prefix.
    expect(out.indexOf('<linearGradient')).toBeLessThan(out.indexOf('<line '));
    expect(out).toMatch(/stroke="url\(#g[0-9a-z]+\)"/);
  });
});
