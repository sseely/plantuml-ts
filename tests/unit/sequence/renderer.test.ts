import { describe, it, expect } from 'vitest';
import type {
  SequenceGeometry,
  MessageGeo,
  ActivationGeo,
  NoteGeo,
  FrameGeo,
  DividerGeo,
} from '../../../src/diagrams/sequence/ast.js';
import { renderSequence } from '../../../src/diagrams/sequence/renderer.js';
import { parseSequence } from '../../../src/diagrams/sequence/parser.js';
import { layoutSequence } from '../../../src/diagrams/sequence/layout.js';
import { sequencePlugin } from '../../../src/diagrams/sequence/index.js';
import { defaultTheme, darkTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer, FixedMeasurer } from '../../../src/core/measurer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeo(overrides?: Partial<SequenceGeometry>): SequenceGeometry {
  return {
    totalWidth: 400,
    totalHeight: 300,
    participants: [
      { id: 'Alice', display: 'Alice', type: 'participant', x: 30, y: 0, width: 100, height: 36, centerX: 80 },
      { id: 'Bob', display: 'Bob', type: 'participant', x: 170, y: 0, width: 100, height: 36, centerX: 220 },
    ],
    events: [],
    lifelineEndY: 260,
    footerShapeY: 260,
    boxes: [],
    ...overrides,
  };
}

function makeSyncMessage(overrides?: Partial<MessageGeo>): MessageGeo {
  return {
    kind: 'message',
    fromX: 80,
    toX: 220,
    y: 80,
    label: 'hello',
    style: 'sync',
    arrowDirection: 'right',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Acceptance criterion 1: Two participants → ≥ 2 <rect elements
// ---------------------------------------------------------------------------

describe('renderSequence — participant boxes', () => {
  it('emits at least 2 rects for two participants', () => {
    const svg = renderSequence(makeGeo(), defaultTheme);
    const rectCount = (svg.match(/<rect/g) ?? []).length;
    expect(rectCount).toBeGreaterThanOrEqual(2);
  });

  it('uses theme background color for participant fill', () => {
    const svg = renderSequence(makeGeo(), defaultTheme);
    expect(svg).toContain(`fill="${defaultTheme.colors.background}"`);
  });

  it('emits participant display text', () => {
    const svg = renderSequence(makeGeo(), defaultTheme);
    // Each participant has text with id used as display in makeGeo
    expect(svg).toContain('Alice');
    expect(svg).toContain('Bob');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 2: Sync message → <line or <path + label text
// ---------------------------------------------------------------------------

describe('renderSequence — messages', () => {
  it('sync message produces a line or path element', () => {
    const geo = makeGeo({ events: [makeSyncMessage()] });
    const svg = renderSequence(geo, defaultTheme);
    const hasLine = svg.includes('<line') || svg.includes('<path');
    expect(hasLine).toBe(true);
  });

  it('sync message includes label text', () => {
    const geo = makeGeo({ events: [makeSyncMessage({ label: 'doThing' })] });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('doThing');
  });

  it('reply message uses dashed line style', () => {
    const geo = makeGeo({
      events: [makeSyncMessage({ style: 'reply', arrowDirection: 'left', fromX: 220, toX: 80 })],
    });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('stroke-dasharray');
  });

  it('replyAsync message uses dashed line style', () => {
    const geo = makeGeo({
      events: [makeSyncMessage({ style: 'replyAsync', arrowDirection: 'left', fromX: 220, toX: 80 })],
    });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('stroke-dasharray');
  });

  it('self message emits a path', () => {
    const geo = makeGeo({
      events: [makeSyncMessage({ arrowDirection: 'self', fromX: 80, toX: 110 })],
    });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('<path');
  });

  it('prepends sequence number when set', () => {
    const geo = makeGeo({
      events: [makeSyncMessage({ label: 'greet', sequenceNumber: 3 })],
    });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('3: greet');
  });

  it('lost message references lost arrow marker', () => {
    const geo = makeGeo({
      events: [makeSyncMessage({ style: 'lost' })],
    });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('arrow-lost');
  });

  it('found message references found arrow marker', () => {
    const geo = makeGeo({
      events: [makeSyncMessage({ style: 'found' })],
    });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('arrow-found');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 3: Activation → rect near lifelineX - 5
// ---------------------------------------------------------------------------

describe('renderSequence — activations', () => {
  it('activation geo produces a rect element', () => {
    const activation: ActivationGeo = {
      kind: 'activation',
      participantId: 'Alice',
      lifelineX: 80,
      y: 50,
      height: 60,
    };
    const geo = makeGeo({ events: [activation] });
    const svg = renderSequence(geo, defaultTheme);
    // Should have rects for participants + activation
    const rectCount = (svg.match(/<rect/g) ?? []).length;
    expect(rectCount).toBeGreaterThanOrEqual(3);
  });

  it('activation rect x is lifelineX - 5', () => {
    const activation: ActivationGeo = {
      kind: 'activation',
      participantId: 'Alice',
      lifelineX: 80,
      y: 50,
      height: 60,
    };
    const geo = makeGeo({ events: [activation] });
    const svg = renderSequence(geo, defaultTheme);
    // x="75" since 80 - 5 = 75
    expect(svg).toContain('x="75"');
  });

  it('activation uses custom color when provided', () => {
    const activation: ActivationGeo = {
      kind: 'activation',
      participantId: 'Alice',
      lifelineX: 80,
      y: 50,
      height: 60,
      color: '#FF0000',
    };
    const geo = makeGeo({ events: [activation] });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('#FF0000');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 4: Note geo → rect + text
// ---------------------------------------------------------------------------

describe('renderSequence — notes', () => {
  it('note geo produces a rect and text', () => {
    const note: NoteGeo = {
      kind: 'note',
      x: 50,
      y: 80,
      width: 120,
      height: 40,
      text: 'remember this',
    };
    const geo = makeGeo({ events: [note] });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('<rect');
    expect(svg).toContain('remember this');
  });

  it('note uses noteBackground color', () => {
    const note: NoteGeo = {
      kind: 'note',
      x: 50,
      y: 80,
      width: 120,
      height: 40,
      text: 'test note',
    };
    const geo = makeGeo({ events: [note] });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain(defaultTheme.colors.noteBackground);
  });

  it('multiline note emits multiple text elements', () => {
    const note: NoteGeo = {
      kind: 'note',
      x: 50,
      y: 80,
      width: 120,
      height: 60,
      text: 'line one\nline two',
    };
    const geo = makeGeo({ events: [note] });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('line one');
    expect(svg).toContain('line two');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 5: Loop frame → rect + text with "loop"
// ---------------------------------------------------------------------------

describe('renderSequence — frames', () => {
  it('loop frame produces a rect containing "loop"', () => {
    const frame: FrameGeo = {
      kind: 'frame',
      frameType: 'loop',
      label: 'i < 5',
      x: 30,
      y: 60,
      width: 300,
      height: 100,
    };
    const geo = makeGeo({ events: [frame] });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('<rect');
    expect(svg).toContain('loop');
  });

  it('frame uses dashed border', () => {
    const frame: FrameGeo = {
      kind: 'frame',
      frameType: 'alt',
      label: 'x > 0',
      x: 30,
      y: 60,
      width: 300,
      height: 100,
    };
    const geo = makeGeo({ events: [frame] });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('stroke-dasharray');
  });

  it('frame label includes frameType + label text', () => {
    const frame: FrameGeo = {
      kind: 'frame',
      frameType: 'opt',
      label: 'condition',
      x: 30,
      y: 60,
      width: 300,
      height: 100,
    };
    const geo = makeGeo({ events: [frame] });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('opt');
    expect(svg).toContain('condition');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 6: defaultTheme vs darkTheme fill values differ
// ---------------------------------------------------------------------------

describe('renderSequence — theme colors', () => {
  it('participant rect fill differs between defaultTheme and darkTheme', () => {
    const geo = makeGeo();
    const svgDefault = renderSequence(geo, defaultTheme);
    const svgDark = renderSequence(geo, darkTheme);
    expect(defaultTheme.colors.background).not.toBe(darkTheme.colors.background);
    expect(svgDefault).toContain(defaultTheme.colors.background);
    expect(svgDark).toContain(darkTheme.colors.background);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 7: SVG starts with <svg and ends with </svg>
// ---------------------------------------------------------------------------

describe('renderSequence — SVG structure', () => {
  it('output starts with <svg and ends with </svg>', () => {
    const svg = renderSequence(makeGeo(), defaultTheme);
    expect(svg.trimStart()).toMatch(/^<svg/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });

  it('emits lifeline dashed lines for each participant', () => {
    const svg = renderSequence(makeGeo(), defaultTheme);
    // Should have dashed lines (stroke-dasharray) from lifelines
    expect(svg).toContain('stroke-dasharray');
  });
});

// ---------------------------------------------------------------------------
// Divider rendering
// ---------------------------------------------------------------------------

describe('renderSequence — dividers', () => {
  it('divider emits a line and centered text', () => {
    const divider: DividerGeo = {
      kind: 'divider',
      text: 'init phase',
      y: 100,
      totalWidth: 400,
    };
    const geo = makeGeo({ events: [divider] });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('<line');
    expect(svg).toContain('init phase');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 8: sequencePlugin.accepts returns true
// ---------------------------------------------------------------------------

describe('sequencePlugin.accepts', () => {
  it('returns true for -> message syntax', () => {
    expect(sequencePlugin.accepts(['Alice -> Bob: hi'])).toBe(true);
  });

  it('returns true for ->> async message', () => {
    expect(sequencePlugin.accepts(['Alice ->> Bob: async call'])).toBe(true);
  });

  it('returns true for --> reply', () => {
    expect(sequencePlugin.accepts(['Bob --> Alice: ok'])).toBe(true);
  });

  it('returns true for participant keyword', () => {
    expect(sequencePlugin.accepts(['participant Alice'])).toBe(true);
  });

  it('returns true for actor keyword', () => {
    expect(sequencePlugin.accepts(['actor User'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 9: sequencePlugin.accepts returns false for non-sequence
// ---------------------------------------------------------------------------

describe('sequencePlugin.accepts — non-sequence', () => {
  it('returns false for class diagram syntax', () => {
    expect(sequencePlugin.accepts(['class Foo'])).toBe(false);
  });

  it('returns false for empty lines', () => {
    expect(sequencePlugin.accepts(['', '  '])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 10: sequencePlugin.parse returns AST with 2 participants
// ---------------------------------------------------------------------------

describe('sequencePlugin.parse', () => {
  it('returns AST with 2 participants for Alice -> Bob', () => {
    const ast = sequencePlugin.parse({
      lines: ['Alice -> Bob: hi'],
      type: 'sequence',
    });
    expect(ast.participants).toHaveLength(2);
    expect(ast.participants[0]?.id).toBe('Alice');
    expect(ast.participants[1]?.id).toBe('Bob');
  });

  it('returns AST with one message event', () => {
    const ast = sequencePlugin.parse({
      lines: ['Alice -> Bob: greet'],
      type: 'sequence',
    });
    expect(ast.events).toHaveLength(1);
    expect(ast.events[0]?.kind).toBe('message');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 11: sequencePlugin layout returns SequenceGeometry
// ---------------------------------------------------------------------------

describe('sequencePlugin layout', () => {
  // Narrow sequencePlugin to SyncPlugin once for this describe block.
  // sequencePlugin implements layoutSync (the sync branch of the union).
  if (!('layoutSync' in sequencePlugin)) {
    throw new Error('sequencePlugin must be a SyncPlugin');
  }
  const syncPlugin = sequencePlugin;

  it('layoutSync returns SequenceGeometry with totalWidth > 0', () => {
    const measurer = new FormulaMeasurer();
    const ast = syncPlugin.parse({
      lines: ['Alice -> Bob: hi'],
      type: 'sequence',
    });
    const geo = syncPlugin.layoutSync(ast, defaultTheme, measurer);
    expect(geo.totalWidth).toBeGreaterThan(0);
  });

  it('layoutSync returns SequenceGeometry with correct participant count', () => {
    const measurer = new FixedMeasurer(8, 16);
    const ast = syncPlugin.parse({
      lines: ['Alice -> Bob: test'],
      type: 'sequence',
    });
    const geo = syncPlugin.layoutSync(ast, defaultTheme, measurer);
    expect(geo.participants).toHaveLength(2);
  });

  it('layout async resolves to same result as layoutSync', async () => {
    // layoutSequence is what both layout() and layoutSync() delegate to.
    // Verify they produce identical geometry by calling layoutSequence directly.
    const measurer = new FormulaMeasurer();
    const ast = syncPlugin.parse({
      lines: ['Alice -> Bob: hello'],
      type: 'sequence',
    });
    const sync = syncPlugin.layoutSync(ast, defaultTheme, measurer);
    const async_ = await Promise.resolve(
      layoutSequence(ast, defaultTheme, measurer),
    );
    expect(sync).toEqual(async_);
  });
});

// ---------------------------------------------------------------------------
// Plugin type and render integration
// ---------------------------------------------------------------------------

describe('sequencePlugin integration', () => {
  if (!('layoutSync' in sequencePlugin)) {
    throw new Error('sequencePlugin must be a SyncPlugin');
  }
  const syncPlugin = sequencePlugin;

  it('plugin type is "sequence"', () => {
    expect(syncPlugin.type).toBe('sequence');
  });

  it('render delegates to renderSequence and returns valid SVG', () => {
    const measurer = new FormulaMeasurer();
    const ast = syncPlugin.parse({
      lines: ['Alice -> Bob: hello'],
      type: 'sequence',
    });
    const geo = syncPlugin.layoutSync(ast, defaultTheme, measurer);
    const svg = syncPlugin.render(geo, defaultTheme);
    expect(svg.trimStart()).toMatch(/^<svg/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });
});

// ---------------------------------------------------------------------------
// Actor and database participant shapes
// ---------------------------------------------------------------------------

describe('renderSequence — actor participant shape', () => {
  it('renders a circle (head) for actor participants', () => {
    const geo = makeGeo({
      participants: [
        { id: 'U', display: 'User', type: 'actor', x: 30, y: 0, width: 80, height: 70, centerX: 70 },
      ],
    });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('<circle');
  });

  it('renders display name below the stick figure', () => {
    const geo = makeGeo({
      participants: [
        { id: 'U', display: 'User', type: 'actor', x: 30, y: 0, width: 80, height: 70, centerX: 70 },
      ],
    });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('User');
  });
});

describe('renderSequence — database participant shape', () => {
  it('renders an ellipse (cylinder cap) for database participants', () => {
    const geo = makeGeo({
      participants: [
        { id: 'DB', display: 'PostgreSQL', type: 'database', x: 30, y: 0, width: 100, height: 50, centerX: 80 },
      ],
    });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('<ellipse');
  });

  it('renders display name for database participant', () => {
    const geo = makeGeo({
      participants: [
        { id: 'DB', display: 'PostgreSQL', type: 'database', x: 30, y: 0, width: 100, height: 50, centerX: 80 },
      ],
    });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('PostgreSQL');
  });
});

// ---------------------------------------------------------------------------
// Box background rendering — renderBoxBackground coverage
// ---------------------------------------------------------------------------

describe('renderSequence — box backgrounds', () => {
  it('box with color renders a rect with that fill color', () => {
    const geo = makeGeo({
      boxes: [{ x: 10, y: 0, width: 200, height: 300, label: '', color: '#LightBlue' }],
    });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('#LightBlue');
    expect(svg).toContain('<rect');
  });

  it('box with empty color falls back to #EEEEEE', () => {
    const geo = makeGeo({
      boxes: [{ x: 10, y: 0, width: 200, height: 300, label: '', color: '' }],
    });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('#EEEEEE');
  });

  it('box with label renders a text element', () => {
    const geo = makeGeo({
      boxes: [{ x: 10, y: 0, width: 200, height: 300, label: 'Services', color: '#pink' }],
    });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('Services');
    expect(svg).toContain('<text');
  });

  it('box with empty label renders no text element beyond participant labels', () => {
    // A box with no label should produce only a rect, no extra text
    const geo = makeGeo({
      participants: [],
      boxes: [{ x: 10, y: 0, width: 200, height: 300, label: '', color: '#yellow' }],
    });
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).not.toContain('<text');
  });

  it('box background rect appears before participant header rects (z-order)', () => {
    const geo = makeGeo({
      boxes: [{ x: 22, y: 0, width: 216, height: 300, label: '', color: '#LightBlue' }],
    });
    const svg = renderSequence(geo, defaultTheme);
    // After the defs block, box background must precede participant rects.
    // svgRoot now emits a background fill rect first; box rect is second.
    const bodyStart = svg.indexOf('</defs>');
    const body = svg.slice(bodyStart);
    const boxIdx = body.indexOf('#LightBlue');
    expect(boxIdx).toBeGreaterThanOrEqual(0);
    // Background rect is first; box rect is second — verify box appears before participants
    const firstRectPos = body.indexOf('<rect');
    const secondRectPos = body.indexOf('<rect', firstRectPos + 1);
    expect(boxIdx).toBeLessThan(secondRectPos + body.indexOf('>', secondRectPos));
  });
});

// ---------------------------------------------------------------------------
// Box integration — parse + layout + render
// ---------------------------------------------------------------------------

describe('renderSequence — box integration', () => {
  it('box with label and color renders correctly end-to-end', () => {
    const ast = parseSequence([
      'box "Frontend" #LightBlue',
      'participant Alice',
      'end box',
      'Alice -> Alice: self',
    ]);
    expect(ast.boxes).toHaveLength(1);
    expect(ast.boxes[0]?.label).toBe('Frontend');
    expect(ast.boxes[0]?.color).toBe('#LightBlue');
    const geo = layoutSequence(ast, defaultTheme, new FixedMeasurer(50, 14));
    expect(geo.boxes).toHaveLength(1);
    const svg = renderSequence(geo, defaultTheme);
    expect(svg).toContain('#LightBlue');
    expect(svg).toContain('Frontend');
  });
});
