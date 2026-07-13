import { describe, it, expect } from 'vitest';
import { renderClass } from '../../../src/diagrams/class/renderer.js';
import { assembleSvg } from '../../../src/index.js';
import { classPlugin } from '../../../src/diagrams/class/index.js';
import type { ClassGeometry, ClassifierGeo, EdgeGeo, NamespaceGeo } from '../../../src/diagrams/class/layout.js';
import { defaultTheme, darkTheme } from '../../../src/core/theme.js';

// ---------------------------------------------------------------------------
// Geometry factory helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal ClassifierGeo without running the layout engine.
 */
function makeClassifierGeo(
  id: string,
  headerText: string,
  overrides?: Partial<ClassifierGeo>,
): ClassifierGeo {
  return {
    id,
    kind: 'class',
    x: 10,
    y: 10,
    width: 120,
    height: 60,
    dividerYs: [28],
    rows: [{ text: headerText, y: 14, indent: 0 }],
    ...overrides,
  };
}

function makeEdgeGeo(overrides?: Partial<EdgeGeo>): EdgeGeo {
  return {
    id: 'edge-0',
    points: [
      { x: 70, y: 70 },
      { x: 70, y: 140 },
    ],
    targetDecor: 'none',
    sourceDecor: 'none',
    dashed: false,
    ...overrides,
  };
}

function makeNamespaceGeo(overrides?: Partial<NamespaceGeo>): NamespaceGeo {
  return {
    id: 'com.example',
    x: 5,
    y: 5,
    width: 200,
    height: 150,
    label: 'com.example',
    ...overrides,
  };
}

function makeMinimalGeo(overrides?: Partial<ClassGeometry>): ClassGeometry {
  return {
    totalWidth: 300,
    totalHeight: 200,
    classifiers: [],
    edges: [],
    namespaces: [],
    notes: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC7: minimal geometry → starts with <svg
// ---------------------------------------------------------------------------

describe('renderClass — minimal geometry', () => {
  it('returns a string starting with <svg', () => {
    const svg = assembleSvg(renderClass(makeMinimalGeo(), defaultTheme));
    expect(svg.startsWith('<svg')).toBe(true);
  });

  it('embeds width and height from geometry', () => {
    const svg = assembleSvg(renderClass(makeMinimalGeo(), defaultTheme));
    expect(svg).toContain('width="300"');
    expect(svg).toContain('height="200"');
  });

  it('includes a background <rect> for the canvas', () => {
    const svg = assembleSvg(renderClass(makeMinimalGeo(), defaultTheme));
    // The background rect has x=0 y=0
    expect(svg).toContain('<rect x="0" y="0"');
  });
});

// ---------------------------------------------------------------------------
// AC1: two classifiers → at least 2 <rect> beyond background
// ---------------------------------------------------------------------------

describe('renderClass — classifiers', () => {
  it('emits at least 2 <rect> elements beyond background for 2 classifiers', () => {
    const geo = makeMinimalGeo({
      classifiers: [
        makeClassifierGeo('Foo', 'Foo'),
        makeClassifierGeo('Bar', 'Bar', { x: 150, y: 10 }),
      ],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    // Count <rect occurrences — background + 2 classifier boxes = at least 3
    const rectCount = (svg.match(/<rect/g) ?? []).length;
    expect(rectCount).toBeGreaterThanOrEqual(3);
  });

  it('emits a divider <line> for each dividerY', () => {
    const geo = makeMinimalGeo({
      classifiers: [
        makeClassifierGeo('Foo', 'Foo', { dividerYs: [28, 50] }),
      ],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('<line');
  });

  it('emits a <text> element containing the header text', () => {
    const geo = makeMinimalGeo({
      classifiers: [makeClassifierGeo('Foo', 'Foo')],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('>Foo<');
  });
});

// ---------------------------------------------------------------------------
// Descriptive elements draw their USymbol icon instead of the class box
// ---------------------------------------------------------------------------

describe('renderClass — descriptive-element icons', () => {
  it('renders a cylinder (not a class box) for a database usymbol', () => {
    const geo = makeMinimalGeo({
      classifiers: [makeClassifierGeo('DB', 'DB', { usymbol: 'database' })],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    // Faithful cylinder (T6): a cubic-cap <path> body + front-mouth <path>,
    // not the old top-cap ellipse + elliptical arc.
    expect(svg.match(/<path/g)?.length).toBe(2);
    expect(svg).toContain(' C ');
    expect(svg).toContain('>DB<');
  });

  it('renders an ellipse for a usecase kind (carries no usymbol)', () => {
    const geo = makeMinimalGeo({
      classifiers: [
        makeClassifierGeo('UC', 'UC', { kind: 'usecase' as ClassifierGeo['kind'] }),
      ],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('>UC<');
  });

  it('renders a notch box for a component usymbol', () => {
    const geo = makeMinimalGeo({
      classifiers: [makeClassifierGeo('C', 'C', { usymbol: 'component' })],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    // outer box + two notch tabs
    expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(svg).toContain('>C<');
  });

  it('draws a plain class box (no icon) for a usymbol with no distinct icon', () => {
    const geo = makeMinimalGeo({
      classifiers: [makeClassifierGeo('N', 'N', { usymbol: 'node' })],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    // no cylinder/ellipse — falls through to the standard box + badge
    expect(svg).not.toContain('<ellipse');
    expect(svg).toContain('>N<');
  });
});

// ---------------------------------------------------------------------------
// AC2: member row text "+bar" appears in <text>
// ---------------------------------------------------------------------------

describe('renderClass — member rows', () => {
  it('renders member row text "+bar" in a <text> element', () => {
    const geo = makeMinimalGeo({
      classifiers: [
        makeClassifierGeo('Foo', 'Foo', {
          rows: [
            { text: 'Foo', y: 14, indent: 0 },
            { text: '+bar', y: 36, indent: 4 },
          ],
        }),
      ],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('+bar');
  });

  it('uses text-anchor=start for rows with indent > 0', () => {
    const geo = makeMinimalGeo({
      classifiers: [
        makeClassifierGeo('Foo', 'Foo', {
          rows: [
            { text: 'Foo', y: 14, indent: 0 },
            { text: '+field: int', y: 36, indent: 4 },
          ],
        }),
      ],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('text-anchor="start"');
  });

  it('uses text-anchor=middle for header row (indent = 0)', () => {
    const geo = makeMinimalGeo({
      classifiers: [makeClassifierGeo('Foo', 'Foo')],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('text-anchor="middle"');
  });
});

// ---------------------------------------------------------------------------
// AC4: classifier fill color driven by kind field
// ---------------------------------------------------------------------------

describe('renderClass — classifier kind fill', () => {
  it('uses classBackground for interface kind (box fill, not badge)', () => {
    const geo = makeMinimalGeo({
      classifiers: [makeClassifierGeo('IFoo', 'IFoo', { kind: 'interface' })],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain(defaultTheme.colors.graph.classBackground);
  });

  it('uses enumBackground for enum kind', () => {
    const geo = makeMinimalGeo({
      classifiers: [makeClassifierGeo('Color', 'Color', { kind: 'enum' })],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain(defaultTheme.colors.graph.enumBackground);
  });

  it('uses classBackground for plain class kind', () => {
    const geo = makeMinimalGeo({
      classifiers: [makeClassifierGeo('Foo', 'Foo')],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain(defaultTheme.colors.graph.classBackground);
  });

  it('uses classBackground for abstract kind', () => {
    const geo = makeMinimalGeo({
      classifiers: [makeClassifierGeo('Base', 'Base', { kind: 'abstract' })],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain(defaultTheme.colors.graph.classBackground);
  });

  it('renders a badge circle for each classifier', () => {
    const geo = makeMinimalGeo({
      classifiers: [makeClassifierGeo('Foo', 'Foo')],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('<circle');
  });

  it('renders italic font-style for interface header row', () => {
    const geo = makeMinimalGeo({
      classifiers: [
        makeClassifierGeo('IFoo', 'IFoo', {
          kind: 'interface',
          rows: [{ text: 'IFoo', y: 14, indent: 0, italic: true }],
        }),
      ],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('font-style="italic"');
  });

  it('renders visibility icon shapes for member rows with visibilityIcon', () => {
    const geo = makeMinimalGeo({
      classifiers: [
        makeClassifierGeo('Foo', 'Foo', {
          rows: [
            { text: 'Foo', y: 14, indent: 0 },
            { text: 'name: String', y: 36, indent: 22, visibilityIcon: '+' },
          ],
        }),
      ],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    // public member → green circle with fill="#81B03A"
    expect(svg).toContain('#81B03A');
  });
});

// ---------------------------------------------------------------------------
// AC3: edge with targetDecor=triangle references arrow-extension marker
// ---------------------------------------------------------------------------

describe('renderClass — edges', () => {
  it('references arrow-extension for targetDecor=triangle', () => {
    const geo = makeMinimalGeo({
      edges: [makeEdgeGeo({ targetDecor: 'triangle' })],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('arrow-extension');
  });

  it('references arrow-dependency for targetDecor=open', () => {
    const geo = makeMinimalGeo({
      edges: [makeEdgeGeo({ targetDecor: 'open' })],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('arrow-dependency');
  });

  it('references arrow-composition for sourceDecor=filledDiamond', () => {
    const geo = makeMinimalGeo({
      edges: [makeEdgeGeo({ sourceDecor: 'filledDiamond' })],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('arrow-composition');
  });

  it('references arrow-aggregation for sourceDecor=diamond', () => {
    const geo = makeMinimalGeo({
      edges: [makeEdgeGeo({ sourceDecor: 'diamond' })],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('arrow-aggregation');
  });

  it('emits stroke-dasharray for dashed edges', () => {
    const geo = makeMinimalGeo({
      edges: [makeEdgeGeo({ dashed: true })],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('stroke-dasharray="5 5"');
  });

  it('does not emit stroke-dasharray for solid edges', () => {
    const geo = makeMinimalGeo({
      edges: [makeEdgeGeo({ dashed: false })],
    });
    // Only the edge path should lack stroke-dasharray; the SVG may still not
    // contain the pattern if no other element emits it.
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    // The path element for this edge should not have a stroke-dasharray
    const pathMatch = /<path[^/]*\/>/.exec(svg);
    expect(pathMatch?.[0]).not.toContain('stroke-dasharray');
  });

  it('renders edge label text when label is present', () => {
    const geo = makeMinimalGeo({
      edges: [
        makeEdgeGeo({
          label: { text: 'uses', x: 70, y: 105 },
        }),
      ],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('uses');
  });

  it('does not emit a <path> when points array is empty', () => {
    // An edge with no points produces no <path>
    const geo = makeMinimalGeo({
      edges: [makeEdgeGeo({ points: [] })],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).not.toContain('<path');
  });
});

// ---------------------------------------------------------------------------
// Namespace boxes
// ---------------------------------------------------------------------------

describe('renderClass — namespaces', () => {
  it('emits a dashed <rect> for each namespace', () => {
    const geo = makeMinimalGeo({
      namespaces: [makeNamespaceGeo()],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('stroke-dasharray="4 2"');
  });

  it('emits the namespace label text', () => {
    const geo = makeMinimalGeo({
      namespaces: [makeNamespaceGeo({ label: 'com.example' })],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('com.example');
  });
});

// ---------------------------------------------------------------------------
// Theme propagation
// ---------------------------------------------------------------------------

describe('renderClass — theme propagation', () => {
  it('uses dark theme background color', () => {
    const svg = assembleSvg(renderClass(makeMinimalGeo(), darkTheme));
    expect(svg).toContain(darkTheme.colors.background);
  });

  it('uses theme border color for classifier stroke', () => {
    const geo = makeMinimalGeo({
      classifiers: [makeClassifierGeo('Foo', 'Foo')],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain(defaultTheme.colors.border);
  });
});

// ---------------------------------------------------------------------------
// AC5 & AC6: classPlugin.accepts()
// ---------------------------------------------------------------------------

describe('classPlugin.accepts()', () => {
  it('returns true for ["class Foo"]', () => {
    expect(classPlugin.accepts(['class Foo'])).toBe(true);
  });

  it('returns true for abstract class line', () => {
    expect(classPlugin.accepts(['abstract class Base'])).toBe(true);
  });

  it('returns true for interface line', () => {
    expect(classPlugin.accepts(['interface IFoo'])).toBe(true);
  });

  it('returns true for enum line', () => {
    expect(classPlugin.accepts(['enum Color'])).toBe(true);
  });

  it('returns true for annotation line', () => {
    expect(classPlugin.accepts(['annotation MyAnnotation'])).toBe(true);
  });

  it('returns true for extension arrow <|--', () => {
    expect(classPlugin.accepts(['Animal <|-- Dog'])).toBe(true);
  });

  it('returns false for ["Alice -> Bob: hi"] (sequence pattern)', () => {
    expect(classPlugin.accepts(['Alice -> Bob: hi'])).toBe(false);
  });

  it('returns false for empty line array', () => {
    expect(classPlugin.accepts([])).toBe(false);
  });

  it('returns false for unrelated lines', () => {
    expect(classPlugin.accepts(['skinparam backgroundColor #EEEBDC'])).toBe(false);
  });

  it('only checks the first 20 lines', () => {
    // Line 21 has a class keyword — should still return false
    const lines = Array.from({ length: 20 }, () => 'title My Diagram');
    lines.push('class Foo');
    expect(classPlugin.accepts(lines)).toBe(false);
  });

  it('has type="class"', () => {
    expect(classPlugin.type).toBe('class');
  });
});

describe('renderClass — notes', () => {
  it('draws a folded note box (fill #FEFFDD), text, and a dashed connector', () => {
    const geo = makeMinimalGeo({
      notes: [
        {
          id: '__note_0',
          x: 20,
          y: 30,
          width: 80,
          height: 40,
          lines: ['hello', 'world'],
          connector: [
            { x: 100, y: 50 },
            { x: 140, y: 50 },
          ],
        },
      ],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).toContain('<polygon');
    expect(svg).toContain('#FEFFDD');
    expect(svg).toContain('hello');
    expect(svg).toContain('world');
    expect(svg).toMatch(/stroke-dasharray="4 4"/);
  });
});

// ---------------------------------------------------------------------------
// Edge markers + per-element color (T8 / D4, D6)
// ---------------------------------------------------------------------------
describe('renderClass — edge markers (T8/D6)', () => {
  it('a plain association (no decor) renders with no markerEnd/markerStart (AC1)', () => {
    const geo = makeMinimalGeo({
      edges: [makeEdgeGeo({ targetDecor: 'none', sourceDecor: 'none' })],
    });
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    expect(svg).not.toContain('marker-end');
    expect(svg).not.toContain('marker-start');
  });

  it('a decorated link keeps its marker — no regression (AC2)', () => {
    const tri = assembleSvg(renderClass(
      makeMinimalGeo({ edges: [makeEdgeGeo({ targetDecor: 'triangle' })] }),
      defaultTheme,
    ));
    expect(tri).toContain(`marker-end="url(#${'arrow-extension'})"`);
    const comp = assembleSvg(renderClass(
      makeMinimalGeo({ edges: [makeEdgeGeo({ sourceDecor: 'filledDiamond' })] }),
      defaultTheme,
    ));
    expect(comp).toContain(`marker-start="url(#${'arrow-composition'})"`);
  });
});

describe('renderClass — descriptive classifier per-element color (T8/D4)', () => {
  it('a class-engine database fills from its own element bucket, not the class color (AC3)', () => {
    const theme = {
      ...defaultTheme,
      colors: { ...defaultTheme.colors, elements: { database: { background: '#AA1122' } } },
    };
    const geo = makeMinimalGeo({
      classifiers: [makeClassifierGeo('DB', 'DB', { usymbol: 'database' })],
    });
    const svg = assembleSvg(renderClass(geo, theme));
    expect(svg).toContain('fill="#AA1122"');
    expect(svg).not.toContain('#FEFECE');
  });
});
