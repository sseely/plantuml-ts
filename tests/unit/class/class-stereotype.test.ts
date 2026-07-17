/**
 * G2 N24: the classifier header stereotype row(s) mechanism --
 * `class-stereotype.ts` (label splitting/measurement/positioning) plus the
 * `hide|show [<<pattern>>] stereotype(s)` directive that filters which
 * labels are visible.
 */
import { describe, it, expect } from 'vitest';
import {
  splitStereotypeLabels,
  measureStereoLabelWidths,
  stereoBlockDim,
  buildStereoRows,
  parseHideStereotypeDirective,
  isStereotypeLabelHidden,
  applyStereotypeHideShow,
  CLASS_STEREOTYPE_FONT_SIZE,
} from '../../../src/diagrams/class/class-stereotype.js';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import type { ClassDiagramAST, HideStereotypeDirective } from '../../../src/diagrams/class/ast.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

const measurer = new FormulaMeasurer();

function makeAST(overrides?: Partial<ClassDiagramAST>): ClassDiagramAST {
  return {
    classifiers: [],
    relationships: [],
    namespaces: [],
    directives: [],
    notes: [],
    ...overrides,
  };
}

function parse(source: string): ClassDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

// ---------------------------------------------------------------------------
// splitStereotypeLabels
// ---------------------------------------------------------------------------

describe('splitStereotypeLabels', () => {
  it('a single label', () => {
    expect(splitStereotypeLabels('Test')).toEqual(['Test']);
  });

  it('recovers STACKED labels from the greedy declaration-parser capture', () => {
    // Mirrors `class-declaration-parser.ts#extractDecorations`'s own doc
    // comment: `<<A>><<B>><<C>>` captures as "A>><<B>><<C" (one blob).
    expect(splitStereotypeLabels('Singleton >>  << Startup >>  << Stateless Session Bean'))
      .toEqual(['Singleton', 'Startup', 'Stateless Session Bean']);
  });

  it('strips a circled-char decoration prefix, keeping only residual text', () => {
    expect(splitStereotypeLabels('(S,#FF7700)Stereotype')).toEqual(['Stereotype']);
    expect(splitStereotypeLabels('(S) Stereotype')).toEqual(['Stereotype']);
  });

  it('drops a label entirely when the decoration prefix has no residual text', () => {
    expect(splitStereotypeLabels('(?, red)')).toEqual([]);
    expect(splitStereotypeLabels('(A, #FF00DD)')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// measureStereoLabelWidths / stereoBlockDim
// ---------------------------------------------------------------------------

describe('measureStereoLabelWidths / stereoBlockDim', () => {
  it('measures each label at the fixed stereotype font size, wrapped in guillemets', () => {
    const widths = measureStereoLabelWidths(['Test'], 'sans-serif', measurer);
    const expected = measurer.measure('«Test»', { family: 'sans-serif', size: CLASS_STEREOTYPE_FONT_SIZE }).width;
    expect(widths).toEqual([expected]);
  });

  it('stereoBlockDim is zero-sized for an empty label list', () => {
    expect(stereoBlockDim([])).toEqual({ width: 0, height: 0 });
  });

  it('stereoBlockDim height is N * CLASS_STEREOTYPE_FONT_SIZE for N stacked labels', () => {
    const dim = stereoBlockDim([10, 30, 20]);
    expect(dim.height).toBe(3 * CLASS_STEREOTYPE_FONT_SIZE);
    expect(dim.width).toBe(30 + 2); // widest label + 2*STEREO_MARGIN
  });
});

// G2 N27: `skinparam guillemet <value>` overrides the wrapper strings a
// stereotype label is measured/drawn with -- default remains "«"/"»" when
// no override is supplied (optional param, additive).
describe('measureStereoLabelWidths — guillemet override (G2 N27)', () => {
  it('measures with the overridden wrapper instead of the default «»', () => {
    const withOverride = measureStereoLabelWidths(['Test'], 'sans-serif', measurer, { start: '<<', end: '>>' });
    const expected = measurer.measure('<<Test>>', { family: 'sans-serif', size: CLASS_STEREOTYPE_FONT_SIZE }).width;
    expect(withOverride).toEqual([expected]);
  });

  it('an empty-string override (guillemet none) measures the bare label', () => {
    const withOverride = measureStereoLabelWidths(['Test'], 'sans-serif', measurer, { start: '', end: '' });
    const expected = measurer.measure('Test', { family: 'sans-serif', size: CLASS_STEREOTYPE_FONT_SIZE }).width;
    expect(withOverride).toEqual([expected]);
  });
});

// ---------------------------------------------------------------------------
// buildStereoRows
// ---------------------------------------------------------------------------

describe('buildStereoRows', () => {
  it('returns no rows and a centered nameTop when there are no labels', () => {
    const result = buildStereoRows({
      labels: [],
      labelWidths: [],
      fontFamily: 'sans-serif',
      circleWidth: 26,
      widthStereoAndName: 70,
      blockDim: { width: 0, height: 0 },
      h1: 0,
      h2: 0,
      headerRowHeight: 24,
      nameLineHeight: 14,
      stereoBaselineOffset: 11,
    });
    expect(result.rows).toEqual([]);
    // diffHeight/2 = (24 - 0 - 14)/2 = 5
    expect(result.nameTop).toBe(5);
  });

  it('places one row per stacked label, each carrying its own indent/width/font', () => {
    const result = buildStereoRows({
      labels: ['A', 'BB'],
      labelWidths: [10, 20],
      fontFamily: 'sans-serif',
      circleWidth: 26,
      widthStereoAndName: 70,
      blockDim: { width: 22, height: 2 * CLASS_STEREOTYPE_FONT_SIZE },
      h1: 0,
      h2: 0,
      headerRowHeight: 24 + 2 * CLASS_STEREOTYPE_FONT_SIZE,
      nameLineHeight: 14,
      stereoBaselineOffset: 11,
    });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ text: '«A»', italic: true, width: 10, fontFamily: 'sans-serif', fontSize: CLASS_STEREOTYPE_FONT_SIZE });
    expect(result.rows[1]).toMatchObject({ text: '«BB»', italic: true, width: 20, fontFamily: 'sans-serif', fontSize: CLASS_STEREOTYPE_FONT_SIZE });
    // second line's top is exactly CLASS_STEREOTYPE_FONT_SIZE below the first
    expect(result.rows[1]!.y - result.rows[0]!.y).toBe(CLASS_STEREOTYPE_FONT_SIZE);
    // nameTop stacks after the whole block
    expect(result.nameTop).toBe(result.rows[0]!.y - 11 + 2 * CLASS_STEREOTYPE_FONT_SIZE);
  });

  // G2 N27: `skinparam guillemet <value>` overrides the row's own drawn
  // text -- default remains "«"/"»" wrapping when no override is supplied.
  it('wraps row text with an overridden guillemet pair when supplied', () => {
    const result = buildStereoRows({
      labels: ['A'],
      labelWidths: [10],
      fontFamily: 'sans-serif',
      circleWidth: 26,
      widthStereoAndName: 70,
      blockDim: { width: 12, height: CLASS_STEREOTYPE_FONT_SIZE },
      h1: 0,
      h2: 0,
      headerRowHeight: 24 + CLASS_STEREOTYPE_FONT_SIZE,
      nameLineHeight: 14,
      stereoBaselineOffset: 11,
      guillemet: { start: '<<', end: '>>' },
    });
    expect(result.rows[0]).toMatchObject({ text: '<<A>>' });
  });
});

// ---------------------------------------------------------------------------
// parseHideStereotypeDirective
// ---------------------------------------------------------------------------

describe('parseHideStereotypeDirective', () => {
  it('a bare "hide stereotype" matches with no pattern', () => {
    expect(parseHideStereotypeDirective('hide stereotype')).toEqual({
      kind: 'hidestereotype', action: 'hide',
    });
  });

  it('a bare "show stereotypes" (plural) matches', () => {
    expect(parseHideStereotypeDirective('show stereotypes')).toEqual({
      kind: 'hidestereotype', action: 'show',
    });
  });

  it('"hide <<pattern>> stereotype" captures the trimmed pattern', () => {
    expect(parseHideStereotypeDirective('hide <<stereo1>> stereotype')).toEqual({
      kind: 'hidestereotype', action: 'hide', pattern: 'stereo1',
    });
  });

  it('returns null for an unrelated line', () => {
    expect(parseHideStereotypeDirective('hide members')).toBeNull();
    expect(parseHideStereotypeDirective('class Foo')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isStereotypeLabelHidden
// ---------------------------------------------------------------------------

describe('isStereotypeLabelHidden', () => {
  it('default (no directives) is visible', () => {
    expect(isStereotypeLabelHidden('stereo1', [])).toBe(false);
  });

  it('a pattern-less hide directive hides every label', () => {
    const directives: HideStereotypeDirective[] = [{ kind: 'hidestereotype', action: 'hide' }];
    expect(isStereotypeLabelHidden('stereo1', directives)).toBe(true);
    expect(isStereotypeLabelHidden('anything', directives)).toBe(true);
  });

  it('a patterned hide only hides the matching label', () => {
    const directives: HideStereotypeDirective[] = [
      { kind: 'hidestereotype', action: 'hide', pattern: 'stereo1' },
    ];
    expect(isStereotypeLabelHidden('stereo1', directives)).toBe(true);
    expect(isStereotypeLabelHidden('stereo2', directives)).toBe(false);
  });

  it('later directives win (last-match-wins scan)', () => {
    const directives: HideStereotypeDirective[] = [
      { kind: 'hidestereotype', action: 'hide' },
      { kind: 'hidestereotype', action: 'show', pattern: 'stereo1' },
    ];
    expect(isStereotypeLabelHidden('stereo1', directives)).toBe(false);
    expect(isStereotypeLabelHidden('stereo2', directives)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyStereotypeHideShow
// ---------------------------------------------------------------------------

describe('applyStereotypeHideShow', () => {
  it('populates visibleStereotypeLabels for a stereotyped classifier, unfiltered when no directives', () => {
    const ast = makeAST({
      classifiers: [{ id: 'C', display: 'C', kind: 'class', typeParams: [], members: [], stereotype: 'Test' }],
    });
    applyStereotypeHideShow(ast);
    expect(ast.classifiers[0]!.visibleStereotypeLabels).toEqual(['Test']);
  });

  it('leaves a non-stereotyped classifier untouched', () => {
    const ast = makeAST({
      classifiers: [{ id: 'C', display: 'C', kind: 'class', typeParams: [], members: [] }],
    });
    applyStereotypeHideShow(ast);
    expect(ast.classifiers[0]!.visibleStereotypeLabels).toBeUndefined();
  });

  it('filters out a hidden label', () => {
    const ast = makeAST({
      classifiers: [{ id: 'C', display: 'C', kind: 'class', typeParams: [], members: [], stereotype: 'stereo1' }],
      hideStereotypeDirectives: [{ kind: 'hidestereotype', action: 'hide', pattern: 'stereo1' }],
    });
    applyStereotypeHideShow(ast);
    expect(ast.classifiers[0]!.visibleStereotypeLabels).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: layoutClass draws a stereotype row above the header
// ---------------------------------------------------------------------------

describe('layoutClass — stereotype row', () => {
  it('a classifier with a stereotype gets an extra row above the header, and headerRowCount reflects it', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'C', display: 'C', kind: 'class', typeParams: [], members: [], stereotype: 'Test' },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    const geo = result.classifiers[0]!;
    expect(geo.headerRowCount).toBe(2);
    expect(geo.rows[0]).toMatchObject({ text: '«Test»', italic: true, fontSize: CLASS_STEREOTYPE_FONT_SIZE });
    expect(geo.rows[1]!.text).toBe('C');
    // the badge indent lives on the NAME row (rows[1]), not the stereo row.
    expect(geo.rows[1]).toHaveProperty('badgeIndent');
    expect(geo.rows[0]).not.toHaveProperty('badgeIndent');
  });

  it('a classifier with no stereotype has headerRowCount undefined (default 1)', () => {
    const ast = makeAST({
      classifiers: [{ id: 'C', display: 'C', kind: 'class', typeParams: [], members: [] }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.headerRowCount).toBeUndefined();
  });

  it('a fully-suppressed (member-less, hide members) stereotyped classifier has ' +
     'box height exactly equal to headerRowHeight (no +4 fallback)', () => {
    const ast = makeAST({
      classifiers: [{ id: 'C', display: 'C', kind: 'class', typeParams: [], members: [], stereotype: 'Test' }],
      directives: [{ kind: 'hideshow', action: 'hide', target: 'members' }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    const geo = result.classifiers[0]!;
    const nameH = measurer.measure('C', { family: defaultTheme.fontFamily, size: defaultTheme.fontSize }).height;
    const expectedHeaderRowHeight = Math.max(32, CLASS_STEREOTYPE_FONT_SIZE + nameH + 10);
    expect(geo.height).toBe(expectedHeaderRowHeight);
    expect(geo.dividerYs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Full-parser integration: `hide <<pattern>> stereotype` end-to-end
// ---------------------------------------------------------------------------

describe('hide|show [<<pattern>>] stereotype(s) — full parser integration', () => {
  it('hides a specific stereotype label engine-wide', () => {
    const ast = parse('class A <<stereo1>>\nhide <<stereo1>> stereotype');
    expect(ast.classifiers[0]!.visibleStereotypeLabels).toEqual([]);
  });

  it('a non-matching pattern leaves the label visible', () => {
    const ast = parse('class A <<stereo1>>\nhide <<other>> stereotype');
    expect(ast.classifiers[0]!.visibleStereotypeLabels).toEqual(['stereo1']);
  });

  it('a bare "hide stereotype" hides every classifier\'s label', () => {
    const ast = parse('class A <<stereo1>>\nclass B <<stereo2>>\nhide stereotype');
    expect(ast.classifiers[0]!.visibleStereotypeLabels).toEqual([]);
    expect(ast.classifiers[1]!.visibleStereotypeLabels).toEqual([]);
  });
});
