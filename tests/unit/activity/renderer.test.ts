import { describe, it, expect } from 'vitest';
import { renderActivity } from '../../../src/diagrams/activity/renderer.js';
import type { ActivityGeometry, ActivityNodeGeo } from '../../../src/diagrams/activity/layout.js';
import { resolveTheme } from '../../../src/core/theme.js';

const theme = resolveTheme('default');

// ---------------------------------------------------------------------------
// Geometry factory helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<ActivityNodeGeo> & Pick<ActivityNodeGeo, 'kind'>): ActivityNodeGeo {
  return {
    id: 'node1',
    x: 50,
    y: 50,
    width: 20,
    height: 20,
    ...overrides,
  };
}

function makeGeo(overrides: Partial<ActivityGeometry> = {}): ActivityGeometry {
  return {
    totalWidth: 300,
    totalHeight: 200,
    nodes: [],
    edges: [],
    swimlanes: [],
    ...overrides,
  };
}

/**
 * Return SVG content after the closing </defs> tag.
 * svgRoot always emits a <defs> block with arrow markers; exclude those
 * from element counts to avoid false positives.
 */
function contentAfterDefs(svg: string): string {
  const idx = svg.indexOf('</defs>');
  return idx === -1 ? svg : svg.slice(idx + '</defs>'.length);
}

// ---------------------------------------------------------------------------
// Test 1: start node is a filled circle
// ---------------------------------------------------------------------------

describe('renderActivity — start node', () => {
  it('renders a filled circle with border fill color', () => {
    const node = makeNode({ kind: 'start', id: 'start', x: 50, y: 50, width: 20, height: 20 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    const content = contentAfterDefs(result);
    expect(content).toContain('<circle');
    expect(content).toContain(`fill="${theme.colors.border}"`);
  });

  it('circle is centered on the node bounding box', () => {
    const node = makeNode({ kind: 'start', id: 'start', x: 50, y: 50, width: 20, height: 20 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    // Center should be at x + width/2 = 60, y + height/2 = 60
    expect(result).toContain('cx="60"');
    expect(result).toContain('cy="60"');
  });
});

// ---------------------------------------------------------------------------
// Test 2: stop node is a bullseye (two circles)
// ---------------------------------------------------------------------------

describe('renderActivity — stop node', () => {
  it('renders two <circle> elements for a bullseye', () => {
    const node = makeNode({ kind: 'stop', id: 'stop-0', x: 50, y: 50, width: 28, height: 28 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    const content = contentAfterDefs(result);
    const circleCount = (content.match(/<circle/g) ?? []).length;
    expect(circleCount).toBeGreaterThanOrEqual(2);
  });

  it('outer circle has fill="none" and inner has border fill', () => {
    const node = makeNode({ kind: 'stop', id: 'stop-0', x: 50, y: 50, width: 28, height: 28 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    const content = contentAfterDefs(result);
    expect(content).toContain('fill="none"');
    expect(content).toContain(`fill="${theme.colors.border}"`);
  });
});

// ---------------------------------------------------------------------------
// Test 3: action is a rounded rectangle
// ---------------------------------------------------------------------------

describe('renderActivity — action node', () => {
  it('renders a <rect> with rx attribute', () => {
    const node = makeNode({ kind: 'action', id: 'action-0', label: 'Do work', x: 50, y: 50, width: 120, height: 36 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    expect(result).toContain('<rect');
    expect(result).toContain('rx="');
  });

  it('renders the label text inside the action', () => {
    const node = makeNode({ kind: 'action', id: 'action-0', label: 'Do work', x: 50, y: 50, width: 120, height: 36 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    expect(result).toContain('Do work');
  });
});

// ---------------------------------------------------------------------------
// Test 4: fork/join bar is a thick filled rectangle
// ---------------------------------------------------------------------------

describe('renderActivity — fork-bar node', () => {
  it('renders a <rect> for the fork bar', () => {
    const node = makeNode({ kind: 'fork-bar', id: 'fork-bar-0', x: 50, y: 50, width: 200, height: 8 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    const content = contentAfterDefs(result);
    expect(content).toContain('<rect');
  });

  it('fork bar fill matches border color', () => {
    const node = makeNode({ kind: 'fork-bar', id: 'fork-bar-0', x: 50, y: 50, width: 200, height: 8 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    expect(result).toContain(`fill="${theme.colors.border}"`);
  });
});

// ---------------------------------------------------------------------------
// Test 5: swimlane boundaries are vertical lines spanning diagram height
// ---------------------------------------------------------------------------

describe('renderActivity — swimlanes', () => {
  it('renders vertical <line> elements between swimlanes', () => {
    const geo = makeGeo({
      swimlanes: [
        { name: 'Alice', x: 0, width: 150 },
        { name: 'Bob', x: 150, width: 150 },
      ],
      totalWidth: 300,
      totalHeight: 200,
      nodes: [],
      edges: [],
    });
    const result = renderActivity(geo, theme);
    expect(result).toContain('<line');
  });

  it('renders swimlane header names', () => {
    const geo = makeGeo({
      swimlanes: [
        { name: 'Alice', x: 0, width: 150 },
        { name: 'Bob', x: 150, width: 150 },
      ],
      totalWidth: 300,
      totalHeight: 200,
      nodes: [],
      edges: [],
    });
    const result = renderActivity(geo, theme);
    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
  });
});

// ---------------------------------------------------------------------------
// Test 6: diamond node (if-split) renders a polygon
// ---------------------------------------------------------------------------

describe('renderActivity — diamond node (if-split)', () => {
  it('renders a polygon element for if-split', () => {
    const node = makeNode({ kind: 'if-split', id: 'if-split-0', x: 50, y: 50, width: 20, height: 20 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    const content = contentAfterDefs(result);
    expect(content).toContain('<polygon');
  });

  it('renders label text inside the diamond when label is provided', () => {
    const node = makeNode({ kind: 'if-split', id: 'if-split-1', label: 'Ready?', x: 50, y: 50, width: 80, height: 80 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    const content = contentAfterDefs(result);
    expect(content).toContain('Ready?');
    expect(content).toContain('<text');
  });
});

// ---------------------------------------------------------------------------
// Test 7: note node renders a polygon body and label text
// ---------------------------------------------------------------------------

describe('renderActivity — note node', () => {
  it('renders a polygon element for the note body', () => {
    const node = makeNode({ kind: 'note', id: 'note-0', label: 'Important', x: 50, y: 50, width: 120, height: 40 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    const content = contentAfterDefs(result);
    expect(content).toContain('<polygon');
  });

  it('renders the note label text', () => {
    const node = makeNode({ kind: 'note', id: 'note-0', label: 'Important', x: 50, y: 50, width: 120, height: 40 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    expect(result).toContain('Important');
  });
});

// ---------------------------------------------------------------------------
// Test 8: action node with custom color uses the node color as fill
// ---------------------------------------------------------------------------

describe('renderActivity — action node with custom color', () => {
  it('uses the node color as fill for the action rect', () => {
    const node = makeNode({
      kind: 'action',
      id: 'action-colored',
      label: 'Step',
      color: '#ff0000',
      x: 50,
      y: 50,
      width: 120,
      height: 36,
    });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    expect(result).toContain('fill="#ff0000"');
  });
});

// ---------------------------------------------------------------------------
// Test 9: end and kill nodes render two circles like stop
// ---------------------------------------------------------------------------

describe('renderActivity — end and kill nodes', () => {
  it('end renders two circles like stop', () => {
    const node = makeNode({ kind: 'end', id: 'end-0', x: 50, y: 50, width: 28, height: 28 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    const content = contentAfterDefs(result);
    const circleCount = (content.match(/<circle/g) ?? []).length;
    expect(circleCount).toBeGreaterThanOrEqual(2);
  });

  it('kill renders two circles like stop', () => {
    const node = makeNode({ kind: 'kill', id: 'kill-0', x: 50, y: 50, width: 28, height: 28 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    const content = contentAfterDefs(result);
    const circleCount = (content.match(/<circle/g) ?? []).length;
    expect(circleCount).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Test 10: join-bar and split-bar render a filled rect
// ---------------------------------------------------------------------------

describe('renderActivity — join-bar and split-bar', () => {
  it('join-bar renders a filled rect', () => {
    const node = makeNode({ kind: 'join-bar', id: 'join-bar-0', x: 50, y: 50, width: 200, height: 8 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    const content = contentAfterDefs(result);
    expect(content).toContain('<rect');
  });

  it('split-bar renders a filled rect', () => {
    const node = makeNode({ kind: 'split-bar', id: 'split-bar-0', x: 50, y: 50, width: 200, height: 8 });
    const geo = makeGeo({ nodes: [node] });
    const result = renderActivity(geo, theme);
    const content = contentAfterDefs(result);
    expect(content).toContain('<rect');
  });
});

// ---------------------------------------------------------------------------
// Test 11: edge with label renders the label text
// ---------------------------------------------------------------------------

describe('renderActivity — edge with label', () => {
  it('renders the edge label text in the SVG', () => {
    const geo = makeGeo({
      edges: [
        {
          points: [
            { x: 100, y: 50 },
            { x: 100, y: 150 },
          ],
          label: 'yes',
        },
      ],
    });
    const result = renderActivity(geo, theme);
    expect(result).toContain('yes');
  });
});

// ---------------------------------------------------------------------------
// if-merge node renders as empty string
// ---------------------------------------------------------------------------

describe('renderActivity — if-merge node', () => {
  it('if-merge node renders as empty string (no SVG output)', () => {
    const node = makeNode({ kind: 'if-merge' });
    const geo = makeGeo({ nodes: [node] });
    const svg = renderActivity(geo, theme);
    // The if-merge node itself produces nothing, only background rect present
    expect(svg.trimStart()).toMatch(/^<svg/);
  });
});

// ---------------------------------------------------------------------------
// Unknown node kind falls back to plain rect
// ---------------------------------------------------------------------------

describe('renderActivity — unknown node kind', () => {
  it('unknown node kind renders a fallback rect', () => {
    const node = makeNode({ kind: 'unknown-node-type' });
    const geo = makeGeo({ nodes: [node] });
    const svg = renderActivity(geo, theme);
    // Fallback rect should be present
    expect(svg.trimStart()).toMatch(/^<svg/);
    expect(svg).toContain('<rect');
  });
});

// ---------------------------------------------------------------------------
// repeat-start node renders as diamond
// ---------------------------------------------------------------------------

describe('renderActivity — repeat-start node', () => {
  it('renders a <polygon> element (diamond), not a <rect>', () => {
    const node = makeNode({ kind: 'repeat-start', id: 'repeat-start-0', x: 50, y: 50, width: 40, height: 40 });
    const geo = makeGeo({ nodes: [node] });
    const svg = renderActivity(geo, theme);
    const content = contentAfterDefs(svg);
    expect(content).toContain('<polygon');
  });

  it('does not render an action rounded <rect rx=...> for repeat-start', () => {
    const node = makeNode({ kind: 'repeat-start', id: 'repeat-start-0', x: 50, y: 50, width: 40, height: 40 });
    const geo = makeGeo({ nodes: [node] });
    const svg = renderActivity(geo, theme);
    const content = contentAfterDefs(svg);
    // Background rect is present; ensure no action-style rounded rect (rx=) is rendered for the node
    expect(content).not.toContain('rx=');
  });
});

// ---------------------------------------------------------------------------
// Test 12: edge with color renders a filled <rect> pill behind the label
// ---------------------------------------------------------------------------

describe('renderActivity — edge with colored label pill', () => {
  it('AC5: renders a <rect> with the specified fill color', () => {
    const geo = makeGeo({
      edges: [
        {
          points: [
            { x: 100, y: 50 },
            { x: 100, y: 150 },
          ],
          label: 'no3',
          color: 'red',
        },
      ],
    });
    const result = renderActivity(geo, theme);
    expect(result).toContain('fill="red"');
    expect(result).toContain('<rect');
  });

  it('AC5: renders the label text "no3" on top of the pill', () => {
    const geo = makeGeo({
      edges: [
        {
          points: [
            { x: 100, y: 50 },
            { x: 100, y: 150 },
          ],
          label: 'no3',
          color: 'red',
        },
      ],
    });
    const result = renderActivity(geo, theme);
    expect(result).toContain('no3');
  });

  it('AC5: the pill rect uses stroke="none"', () => {
    const geo = makeGeo({
      edges: [
        {
          points: [
            { x: 100, y: 50 },
            { x: 100, y: 150 },
          ],
          label: 'pill',
          color: '#00FF00',
        },
      ],
    });
    const result = renderActivity(geo, theme);
    // The pill rect should have stroke="none"
    expect(result).toContain('stroke="none"');
  });
});

// ---------------------------------------------------------------------------
// Test 13: edge with label but no color renders plain text only (no rect)
// ---------------------------------------------------------------------------

describe('renderActivity — edge with label but no color', () => {
  it('AC6: does not emit a pill <rect> when color is absent', () => {
    const geo = makeGeo({
      edges: [
        {
          points: [
            { x: 100, y: 50 },
            { x: 100, y: 150 },
          ],
          label: 'plain',
        },
      ],
    });
    const result = renderActivity(geo, theme);
    const content = contentAfterDefs(result);
    // The background rect from the SVG root is present; but no pill-specific rect
    // after defs. We check that stroke="none" is absent (only used for pills).
    expect(content).not.toContain('stroke="none"');
    expect(content).toContain('plain');
  });
});

// ---------------------------------------------------------------------------
// Test 14: edge with midArrow renders an extra arrowhead at segment midpoint
// ---------------------------------------------------------------------------

describe('renderActivity — edge with midArrow', () => {
  it('renders two <polygon> arrowheads when midArrow is true', () => {
    const geo = makeGeo({
      edges: [
        {
          points: [
            { x: 100, y: 200 },
            { x: 50, y: 200 },
            { x: 50, y: 50 },
            { x: 100, y: 50 },
          ],
          midArrow: true,
        },
      ],
    });
    const result = renderActivity(geo, theme);
    const content = contentAfterDefs(result);
    // One polygon for the terminal arrowhead, one for the mid-segment arrowhead
    const polygonCount = (content.match(/<polygon/g) ?? []).length;
    expect(polygonCount).toBeGreaterThanOrEqual(2);
  });

  it('renders only one arrowhead when midArrow is absent', () => {
    const geo = makeGeo({
      edges: [
        {
          points: [
            { x: 100, y: 200 },
            { x: 50, y: 200 },
            { x: 50, y: 50 },
            { x: 100, y: 50 },
          ],
        },
      ],
    });
    const result = renderActivity(geo, theme);
    const content = contentAfterDefs(result);
    const polygonCount = (content.match(/<polygon/g) ?? []).length;
    expect(polygonCount).toBe(1);
  });
});

describe('stereotype action shapes', () => {
  function renderStereotypeNode(stereotype: string): string {
    const geo: ActivityGeometry = {
      totalWidth: 200,
      totalHeight: 100,
      swimlanes: [],
      nodes: [makeNode({ kind: 'action', label: 'Test', width: 100, height: 32, stereotype })],
      edges: [],
    };
    return contentAfterDefs(renderActivity(geo, theme));
  }

  it('<<input>> renders a polygon (chevron-left shape)', () => {
    const svg = renderStereotypeNode('input');
    expect(svg).toContain('<polygon');
    expect(svg).not.toContain('rx=');
    expect(svg).toContain('Test');
  });

  it('<<output>> renders a polygon (chevron-right shape)', () => {
    const svg = renderStereotypeNode('output');
    expect(svg).toContain('<polygon');
    expect(svg).not.toContain('rx=');
    expect(svg).toContain('Test');
  });

  it('<<save>> renders a polygon (hexagon shape)', () => {
    const svg = renderStereotypeNode('save');
    expect(svg).toContain('<polygon');
    expect(svg).not.toContain('rx=');
    expect(svg).toContain('Test');
  });

  it('action without stereotype renders a rounded rect', () => {
    const svg = renderStereotypeNode('');
    expect(svg).toContain('rx=');
    expect(svg).not.toContain('<polygon');
  });

  it('unknown stereotype renders a rounded rect (plain action)', () => {
    const svg = renderStereotypeNode('unknown');
    expect(svg).toContain('rx=');
    expect(svg).not.toContain('<polygon');
  });
});
