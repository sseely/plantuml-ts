import { describe, it, expect } from 'vitest';
import { renderChronology } from '../../../src/diagrams/chronology/renderer.js';
import type { ChronologyGeometry, EventGeometry, DayTick } from '../../../src/diagrams/chronology/ast.js';
import { resolveTheme } from '../../../src/core/theme.js';

const theme = resolveTheme('default');

function makeGeo(partial?: Partial<ChronologyGeometry>): ChronologyGeometry {
  return {
    events: [],
    dayTicks: [],
    totalWidth: 1000,
    totalHeight: 80,
    baselineY: 40,
    headerHeight: 30,
    ...partial,
  };
}

function makeEvent(partial: Partial<EventGeometry> & { name: string; x: number }): EventGeometry {
  return {
    labelAbove: false,
    ...partial,
  };
}

function makeTick(x: number, label: string): DayTick {
  return { x, label };
}

/**
 * Strip the <defs>…</defs> block from SVG output before counting
 * diagram-body elements.  svgRoot embeds arrowhead marker polygons inside
 * <defs> — those must not count against diagram-level polygon tallies.
 */
function stripDefs(svg: string): string {
  return svg.replace(/<defs>[\s\S]*?<\/defs>/g, '');
}

const CORPUS_EVENTS: EventGeometry[] = [
  makeEvent({ name: 'Event1', x: 200, labelAbove: true }),
  makeEvent({ name: 'Event2', x: 600, labelAbove: false }),
];

const CORPUS_TICKS: DayTick[] = [
  makeTick(0, '2023-11-20'),
  makeTick(200, '2023-11-21'),
  makeTick(400, '2023-11-22'),
  makeTick(600, '2023-11-23'),
  makeTick(800, '2023-11-24'),
];

function corpusGeo(): ChronologyGeometry {
  return makeGeo({ events: CORPUS_EVENTS, dayTicks: CORPUS_TICKS });
}

// ---------------------------------------------------------------------------
// AC1: SVG output contains <polygon (one per event)
// ---------------------------------------------------------------------------

describe('AC1 — polygon count matches event count', () => {
  it('produces exactly 2 <polygon elements for 2 events', () => {
    const body = stripDefs(renderChronology(corpusGeo(), theme));
    const matches = body.match(/<polygon/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2);
  });

  it('produces 0 <polygon elements when events is empty', () => {
    const body = stripDefs(renderChronology(makeGeo(), theme));
    const matches = body.match(/<polygon/g);
    expect(matches).toBeNull();
  });

  it('produces exactly 1 <polygon element for 1 event', () => {
    const body = stripDefs(
      renderChronology(
        makeGeo({ events: [makeEvent({ name: 'Solo', x: 100 })] }),
        theme,
      ),
    );
    const matches = body.match(/<polygon/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC2: SVG contains the horizontal baseline <line
// ---------------------------------------------------------------------------

describe('AC2 — baseline line is present', () => {
  it('contains a baseline line with stroke #333333', () => {
    const svg = renderChronology(corpusGeo(), theme);
    expect(svg).toContain('stroke="#333333"');
  });

  it('baseline stroke-width is 1.5', () => {
    const svg = renderChronology(corpusGeo(), theme);
    expect(svg).toContain('stroke-width="1.5"');
  });
});

// ---------------------------------------------------------------------------
// AC3: SVG contains each day label string
// ---------------------------------------------------------------------------

describe('AC3 — day label strings appear in SVG', () => {
  it('contains 2023-11-20', () => {
    const svg = renderChronology(corpusGeo(), theme);
    expect(svg).toContain('2023-11-20');
  });

  it('contains 2023-11-24', () => {
    const svg = renderChronology(corpusGeo(), theme);
    expect(svg).toContain('2023-11-24');
  });

  it('contains all 5 day label strings', () => {
    const svg = renderChronology(corpusGeo(), theme);
    for (const tick of CORPUS_TICKS) {
      expect(svg).toContain(tick.label);
    }
  });
});

// ---------------------------------------------------------------------------
// AC4: SVG contains stroke-dasharray (dashed event ticks)
// ---------------------------------------------------------------------------

describe('AC4 — stroke-dasharray present for event ticks', () => {
  it('contains stroke-dasharray attribute', () => {
    const svg = renderChronology(corpusGeo(), theme);
    expect(svg).toContain('stroke-dasharray');
  });

  it('uses 3 3 dash pattern', () => {
    const svg = renderChronology(corpusGeo(), theme);
    expect(svg).toContain('stroke-dasharray="3 3"');
  });
});

// ---------------------------------------------------------------------------
// AC5: SVG contains width or viewBox attribute (from svgRoot)
// ---------------------------------------------------------------------------

describe('AC5 — svgRoot produces width/viewBox', () => {
  it('contains width attribute on root svg', () => {
    const svg = renderChronology(corpusGeo(), theme);
    expect(svg).toMatch(/width="\d+"/);
  });

  it('contains viewBox attribute on root svg', () => {
    const svg = renderChronology(corpusGeo(), theme);
    expect(svg).toContain('viewBox=');
  });
});

// ---------------------------------------------------------------------------
// AC6: Corpus geometry (2 events, 5 day ticks) — exactly 2 <polygon
// ---------------------------------------------------------------------------

describe('AC6 — corpus geometry polygon count', () => {
  it('exactly 2 polygons outside defs with corpus geometry', () => {
    const body = stripDefs(renderChronology(corpusGeo(), theme));
    const matches = body.match(/<polygon/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// AC7: Empty geometry renders without throwing
// ---------------------------------------------------------------------------

describe('AC7 — empty geometry does not throw', () => {
  it('renders without error for empty events and dayTicks', () => {
    expect(() => renderChronology(makeGeo(), theme)).not.toThrow();
  });

  it('returns a non-empty string for empty geometry', () => {
    const svg = renderChronology(makeGeo(), theme);
    expect(svg.length).toBeGreaterThan(0);
    expect(svg).toContain('<svg');
  });
});

// ---------------------------------------------------------------------------
// AC8: Label positioning — above does NOT include dominant-baseline=hanging;
//       below DOES include it
// ---------------------------------------------------------------------------

describe('AC8 — label dominant-baseline based on labelAbove', () => {
  it('label above baseline does not include dominant-baseline="hanging"', () => {
    const svg = renderChronology(
      makeGeo({ events: [makeEvent({ name: 'AboveEvent', x: 100, labelAbove: true })] }),
      theme,
    );
    // Locate the text element that wraps the event name
    const nameIdx = svg.indexOf('AboveEvent');
    // Look at the ~200 chars preceding the name for the text element's attributes
    const window = svg.slice(Math.max(0, nameIdx - 200), nameIdx);
    expect(window).not.toContain('dominant-baseline="hanging"');
  });

  it('label below baseline includes dominant-baseline="hanging"', () => {
    const svg = renderChronology(
      makeGeo({ events: [makeEvent({ name: 'BelowEvent', x: 100, labelAbove: false })] }),
      theme,
    );
    const nameIdx = svg.indexOf('BelowEvent');
    const window = svg.slice(Math.max(0, nameIdx - 200), nameIdx);
    expect(window).toContain('dominant-baseline="hanging"');
  });
});

// ---------------------------------------------------------------------------
// AC9: SVG contains event name strings
// ---------------------------------------------------------------------------

describe('AC9 — event name strings appear in SVG', () => {
  it('contains Event1', () => {
    const svg = renderChronology(corpusGeo(), theme);
    expect(svg).toContain('Event1');
  });

  it('contains Event2', () => {
    const svg = renderChronology(corpusGeo(), theme);
    expect(svg).toContain('Event2');
  });

  it('contains custom event name', () => {
    const svg = renderChronology(
      makeGeo({ events: [makeEvent({ name: 'DeploymentFreeze', x: 300 })] }),
      theme,
    );
    expect(svg).toContain('DeploymentFreeze');
  });
});
