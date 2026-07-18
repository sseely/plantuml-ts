/**
 * G2 N24: the classifier header stereotype row(s) mechanism --
 * `class-stereotype.ts` (label splitting/measurement/positioning) plus the
 * `hide|show [<<pattern>>] stereotype(s)` directive that filters which
 * labels are visible.
 */
import { describe, it, expect } from 'vitest';
import {
  splitStereotypeLabels,
  splitStereotypeStyleTags,
  measureStereoLabelWidths,
  stereoBlockDim,
  buildStereoRows,
  parseHideStereotypeDirective,
  isStereotypeLabelHidden,
  applyStereotypeHideShow,
  measureGenericTagDim,
  buildGenericTagGeo,
  CLASS_STEREOTYPE_FONT_SIZE,
  resolveVisibleStereotypeLabels,
  resolveStyleStereotypeTags,
} from '../../../src/diagrams/class/class-stereotype.js';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import { DeterministicMeasurer } from '../../../src/core/measurer-deterministic.js';
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
// TRIPLE-bracket invisible-but-style-active stereotype (G2 N37) --
// `class AliceMyStyle <<<mystyle>>>` (parses to `Classifier.stereotype ===
// "<mystyle>"`, `class-declaration-parser.ts`'s non-greedy-vs-source
// capture quirk) draws NO visible stereotype text row but STILL matches a
// `.mystyle { ... }` style-cascade selector -- jar-verified
// `dozude-05-jeve029`.
// ---------------------------------------------------------------------------
describe('splitStereotypeLabels / splitStereotypeStyleTags -- 2-vs-3-bracket split (G2 N37)', () => {
  it('a 2-bracket label is visible AND a style tag', () => {
    expect(splitStereotypeLabels('mystyle')).toEqual(['mystyle']);
    expect(splitStereotypeStyleTags('mystyle')).toEqual(['mystyle']);
  });

  it('a 3-bracket label (`<mystyle>` after grammar capture) is a style tag but NOT visible', () => {
    expect(splitStereotypeLabels('<mystyle>')).toEqual([]);
    expect(splitStereotypeStyleTags('<mystyle>')).toEqual(['mystyle']);
  });

  it('a mix of 2-and-3-bracket stacked labels splits independently per label', () => {
    // Reconstructs to `<<A>><<<B>>>` -- "A" visible+style, "B" style-only.
    expect(splitStereotypeLabels('A>><<<B')).toEqual(['A']);
    expect(splitStereotypeStyleTags('A>><<<B')).toEqual(['A', 'B']);
  });
});

describe('resolveVisibleStereotypeLabels / resolveStyleStereotypeTags (G2 N37)', () => {
  const base = { id: 'a', kind: 'class' as const, display: 'A', typeParams: [], members: [] };

  it('falls back to an unfiltered split when visibleStereotypeLabels is unset', () => {
    const classifier = { ...base, stereotype: 'mystyle' };
    expect(resolveVisibleStereotypeLabels(classifier)).toEqual(['mystyle']);
    expect(resolveStyleStereotypeTags(classifier)).toEqual(['mystyle']);
  });

  it('prefers the post-hideshow-filtered visibleStereotypeLabels when populated', () => {
    const classifier = { ...base, stereotype: 'mystyle', visibleStereotypeLabels: [] };
    expect(resolveVisibleStereotypeLabels(classifier)).toEqual([]);
    // Style-tag resolution is INDEPENDENT of hide/show display filtering.
    expect(resolveStyleStereotypeTags(classifier)).toEqual(['mystyle']);
  });

  it('returns an empty list for a classifier with no stereotype at all', () => {
    const classifier = { ...base };
    expect(resolveVisibleStereotypeLabels(classifier)).toEqual([]);
    expect(resolveStyleStereotypeTags(classifier)).toEqual([]);
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

// G2 N39: `skinparam classStereotypeFontSize` -- overrides the fixed 12pt
// default, threaded through as an explicit trailing param (`theme.ts
// #classStereotypeFontSize`'s doc comment, disambiguated from
// `circledCharacterFontSize` -- G2 N38 -- via `datugo-88-sote552`'s own
// byte-exact formula match).
describe('measureStereoLabelWidths / stereoBlockDim — fontSize override (G2 N39)', () => {
  it('measures at the overridden fontSize instead of the hardcoded default', () => {
    const widths = measureStereoLabelWidths(['Test'], 'sans-serif', measurer, undefined, 20);
    const expected = Math.round(
      measurer.measure('«Test»', { family: 'sans-serif', size: 20 }).width * 10000,
    ) / 10000;
    expect(widths).toEqual([expected]);
  });

  it('stereoBlockDim height scales with the overridden fontSize', () => {
    const dim = stereoBlockDim([10, 30, 20], 20);
    expect(dim.height).toBe(3 * 20);
    expect(dim.width).toBe(30 + 2);
  });

  it('falls back to CLASS_STEREOTYPE_FONT_SIZE when fontSize is omitted', () => {
    const widths = measureStereoLabelWidths(['Test'], 'sans-serif', measurer);
    const expected = measurer.measure('«Test»', { family: 'sans-serif', size: CLASS_STEREOTYPE_FONT_SIZE }).width;
    expect(widths).toEqual([expected]);
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
      fontSize: CLASS_STEREOTYPE_FONT_SIZE,
      italic: true,
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
      fontSize: CLASS_STEREOTYPE_FONT_SIZE,
      italic: true,
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
      fontSize: CLASS_STEREOTYPE_FONT_SIZE,
      italic: true,
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

  // G2 N39: `skinparam classStereotypeFontSize`/`FontStyle` -- end-to-end
  // through `layoutClass`, jar-verified `datugo-88-sote552`/`teluve-08-
  // moco846` (`FontParam.CLASS_STEREOTYPE`, disambiguated from the badge's
  // OWN `circledCharacterFontSize` -- G2 N38).
  it('a theme-resolved classStereotypeFontSize/FontStyle override reaches the stereo row', () => {
    const ast = makeAST({
      classifiers: [{ id: 'C', display: 'C', kind: 'class', typeParams: [], members: [], stereotype: 'Test' }],
    });
    const theme = {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        graph: {
          ...defaultTheme.colors.graph,
          classStereotypeFontSize: 20,
          classStereotypeFontBold: true,
          classStereotypeFontItalic: false,
        },
      },
    };
    const result = layoutClass(ast, theme, measurer);
    const geo = result.classifiers[0]!;
    expect(geo.rows[0]).toMatchObject({ text: '«Test»', fontSize: 20, italic: false, bold: true });
  });

  it('falls back to the hardcoded default (12pt, italic, no bold) when unset', () => {
    const ast = makeAST({
      classifiers: [{ id: 'C', display: 'C', kind: 'class', typeParams: [], members: [], stereotype: 'Test' }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    const geo = result.classifiers[0]!;
    expect(geo.rows[0]).toMatchObject({ text: '«Test»', fontSize: CLASS_STEREOTYPE_FONT_SIZE, italic: true });
    expect(geo.rows[0]).not.toHaveProperty('bold');
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
// G2 N64 item 45: classifier display-name `\n`/`\l`/`\r` line-wrapping --
// `Display.getWithNewlines` (CommandCreateClass.java:191) runs over a
// classifier's own display string the SAME way it runs over a relationship
// label (item 43, N63) -- `EntityImageClassHeader.java:103-108` builds the
// header TextBlock straight from `entity.getDisplay()`, honoring the SAME
// natural-alignment-overrides-CENTER rule (`Display#create0`,
// `getNaturalHorizontalAlignment() != null` wins). Reuses `splitEdgeLabelLines`
// verbatim (no second state-machine port) -- see `class-layout-helpers.ts
// #measureGenericClassifier`'s own doc comment for the full jar derivation.
// ---------------------------------------------------------------------------

describe('layoutClass — item 45, multi-line classifier display-name header', () => {
  it('splits the header into one row per `\\n` line, headerRowCount ' +
     'reflects it, and headerRowHeight stacks `lines.length * headerFont.size` ' +
     '-- jar-verified against dofima-22-kofe334 (`hide circle`, `class ' +
     '"User\\n(User in our system)" as user`)', () => {
    const detMeasurer = new DeterministicMeasurer();
    const ast = makeAST({
      classifiers: [{
        id: 'user', display: 'User\\n(User in our system)', kind: 'class',
        typeParams: [], members: [], hideCircle: true,
      }],
      directives: [{ kind: 'hideshow', action: 'hide', target: 'members' }],
    });
    const result = layoutClass(ast, defaultTheme, detMeasurer);
    const geo = result.classifiers[0]!;
    expect(geo.headerRowCount).toBe(2);
    expect(geo.rows).toHaveLength(2);
    expect(geo.rows[0]!.text).toBe('User');
    expect(geo.rows[1]!.text).toBe('(User in our system)');
    // jar's real divider offset from box top on dofima's golden SVG is
    // 45 - 7 = 38 = 2 lines * 14pt headerFont.size + 10 (HeaderLayout
    // #getDimension's own additive term) — was 24 (1-line formula) pre-fix.
    expect(geo.height).toBe(38);
    expect(geo.dividerYs).toEqual([]);
    // member-less box width == headerWidth exactly (no member area), so
    // h1 === h2 === 0 (computeHeaderSlack's own suppWith === 0 case): the
    // WIDEST line ("(User in our system)") sits flush at the block's own
    // left edge (indent === NAME_LEFT_MARGIN === 3); the narrower "User"
    // line CENTERS within that same block width — jar-verified x delta
    // (dofima's golden `75.3 - 32.95 === 42.35`).
    expect(geo.rows[1]!.indent).toBe(3);
    expect(geo.rows[0]!.indent).toBeCloseTo(3 + (114.275 - 29.575) / 2, 4);
    // per-line y stacks by exactly headerFont.size (14) — jar-verified
    // (dofima's golden `36.8889 - 22.8889 === 14`).
    expect(geo.rows[1]!.y - geo.rows[0]!.y).toBeCloseTo(14, 4);
  });

  it('a single-line display name is unaffected (headerRowCount stays undefined, one row)', () => {
    const detMeasurer = new DeterministicMeasurer();
    const ast = makeAST({
      classifiers: [{ id: 'C', display: 'C', kind: 'class', typeParams: [], members: [] }],
    });
    const result = layoutClass(ast, defaultTheme, detMeasurer);
    const geo = result.classifiers[0]!;
    expect(geo.headerRowCount).toBeUndefined();
    expect(geo.rows[0]!.text).toBe('C');
  });

  it('`\\l` sets LEFT alignment for every line (last-wins, matches item 43\'s ' +
     '`splitEdgeLabelLines` alignment rule) -- both lines share the SAME left indent', () => {
    const detMeasurer = new DeterministicMeasurer();
    const ast = makeAST({
      classifiers: [{
        id: 'x', display: 'Short\\lA much longer second line', kind: 'class',
        typeParams: [], members: [], hideCircle: true,
      }],
      directives: [{ kind: 'hideshow', action: 'hide', target: 'members' }],
    });
    const result = layoutClass(ast, defaultTheme, detMeasurer);
    const geo = result.classifiers[0]!;
    expect(geo.rows[0]!.indent).toBe(geo.rows[1]!.indent);
  });

  it('a stereotype-bearing classifier with a multi-line name stacks BOTH ' +
     'mechanisms: stereo row(s), then N name-line rows, headerRowCount === sum', () => {
    const detMeasurer = new DeterministicMeasurer();
    const ast = makeAST({
      classifiers: [{
        id: 'C', display: 'Line1\\nLine2', kind: 'class', typeParams: [], members: [],
        stereotype: 'Test',
      }],
    });
    const result = layoutClass(ast, defaultTheme, detMeasurer);
    const geo = result.classifiers[0]!;
    expect(geo.headerRowCount).toBe(3);
    expect(geo.rows[0]!.text).toBe('«Test»');
    expect(geo.rows[1]!.text).toBe('Line1');
    expect(geo.rows[2]!.text).toBe('Line2');
    // badge indent lives on the LAST name row, never a stereo row or an
    // earlier name-line row.
    expect(geo.rows[2]).toHaveProperty('badgeIndent');
    expect(geo.rows[0]).not.toHaveProperty('badgeIndent');
    expect(geo.rows[1]).not.toHaveProperty('badgeIndent');
  });

  // G2 N64 (item 45 corollary): `class-declaration-parser.ts
  // #extractGenericFromDisplay`'s `^([^\s<>]+)(<.*>)$` generic-tag capture
  // treats the `\n` escape's own two characters as ordinary (non-
  // whitespace) content, so `class "Name\n<Generic>" as x` leaves a
  // TRAILING `\n` on the base display after the `<Generic>` suffix is
  // stripped -- `splitEdgeLabelLines` then produces a genuinely BLANK
  // final line. Jar-verified against `julixi-10-jide878`'s golden
  // `csprob2dtd` entity: a lone NBSP `<text textLength="3.85">` draws for
  // that blank line (`DriverTextSvg.java`'s `^\s*$` RENDER-time
  // substitution, N57 item 38's already-landed mechanism generalized here
  // to a genuinely EMPTY string, which N57's own `MemberRenderAtom` port
  // deliberately excluded -- zero corpus reach for an empty creole text
  // atom at the time, unlike a header line).
  it('a trailing blank line (post `<Generic>` extraction leaves `\\n` at ' +
     'the end of the base display) renders as a lone NBSP, LAYOUT-positioned ' +
     'at its raw (zero) width -- jar-verified against julixi-10-jide878\'s ' +
     '`csprob2dtd`', () => {
    const detMeasurer = new DeterministicMeasurer();
    const ast = makeAST({
      classifiers: [{
        id: 'csprob2dtd', display: 'CuttingStockPrb\\n', kind: 'class',
        typeParams: ['two_dims_td'], members: [],
      }],
    });
    const result = layoutClass(ast, defaultTheme, detMeasurer);
    const geo = result.classifiers[0]!;
    expect(geo.headerRowCount).toBe(2);
    expect(geo.rows[0]!.text).toBe('CuttingStockPrb');
    // U+00A0 (NBSP), not a plain space or an empty string.
    expect(geo.rows[1]!.text).toBe('\u00A0');
    // jar's own drawn textLength for the NBSP glyph -- NOT 0 (the raw
    // empty-string width the LAYOUT/indent math below still uses).
    expect(geo.rows[1]!.width).toBeCloseTo(3.85, 4);
    // jar-verified x delta (julixi's own golden: 242.955 - 192.38 = 50.575)
    // -- computed from the RAW (zero) layout width, not the NBSP glyph's.
    expect(geo.rows[1]!.indent - geo.rows[0]!.indent).toBeCloseTo(50.575, 4);
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


// ---------------------------------------------------------------------------
// G2 N32: `class Foo<T>`/`class Bar<P, Q>` generic type-parameter tag box --
// `measureGenericTagDim`/`buildGenericTagGeo`. Jar-verified end-to-end
// (byte-exact) against `caboco-62-jula911` ("Param": rect width 37.325,
// height 14, x 68.15, y 7, text x 69.15, y 17.3333, textLength 35.325 --
// "P, Q": rect width 22.625, x 196.3175) -- these unit tests pin the same
// formula in isolation.
// ---------------------------------------------------------------------------

describe('measureGenericTagDim (G2 N32)', () => {
  it('returns undefined for a classifier with no type parameters', () => {
    expect(measureGenericTagDim([], 'sans-serif', measurer)).toBeUndefined();
  });

  it('measures a single type parameter -- width/height fold in BOTH ' +
    '`withMargin(_, 1, 1)` applications (4px total per axis)', () => {
    const dim = measureGenericTagDim(['Param'], 'sans-serif', new DeterministicMeasurer());
    const rawTextWidth = new DeterministicMeasurer()
      .measure('Param', { family: 'sans-serif', size: CLASS_STEREOTYPE_FONT_SIZE }).width;
    expect(dim).toEqual({
      width: rawTextWidth + 4,
      height: CLASS_STEREOTYPE_FONT_SIZE + 4,
      rawTextWidth,
    });
  });

  it('joins multiple type parameters with ", "', () => {
    const dim = measureGenericTagDim(['P', 'Q'], 'sans-serif', new DeterministicMeasurer());
    const rawTextWidth = new DeterministicMeasurer()
      .measure('P, Q', { family: 'sans-serif', size: CLASS_STEREOTYPE_FONT_SIZE }).width;
    expect(dim?.rawTextWidth).toBe(rawTextWidth);
  });

  // G2 N49: an explicit `rawText` override (`Classifier.typeParamsRawText`)
  // takes priority over `typeParams.join(', ')` -- jar never re-splits/
  // rejoins the captured generic clause, so a no-space source ("K,V")
  // must measure/render VERBATIM, not as "K, V".
  it('uses the verbatim rawText override instead of re-joining typeParams when provided', () => {
    const dim = measureGenericTagDim(['K', 'V'], 'sans-serif', new DeterministicMeasurer(), CLASS_STEREOTYPE_FONT_SIZE, 'K,V');
    const rawTextWidth = Math.round(
      new DeterministicMeasurer()
        .measure('K,V', { family: 'sans-serif', size: CLASS_STEREOTYPE_FONT_SIZE }).width * 10000,
    ) / 10000;
    expect(dim?.rawTextWidth).toBe(rawTextWidth);
    // The re-join fallback ("K, V") measures DIFFERENTLY from the verbatim
    // "K,V" -- proves rawText genuinely changed the measured text, not a
    // no-op (the two strings differ by one space character).
    const joinedWidth = new DeterministicMeasurer()
      .measure('K, V', { family: 'sans-serif', size: CLASS_STEREOTYPE_FONT_SIZE }).width;
    expect(dim?.rawTextWidth).not.toBe(joinedWidth);
  });

  // G2 N39: `skinparam classStereotypeFontSize` -- SAME FontParam the
  // stereotype label row(s) use (`EntityImageClassHeader.java:144-148`).
  it('measures at an overridden fontSize instead of the hardcoded default', () => {
    const dim = measureGenericTagDim(['Param'], 'sans-serif', new DeterministicMeasurer(), 20);
    const rawTextWidth = Math.round(
      new DeterministicMeasurer().measure('Param', { family: 'sans-serif', size: 20 }).width * 10000,
    ) / 10000;
    expect(dim).toEqual({ width: rawTextWidth + 4, height: 20 + 4, rawTextWidth });
  });
});

describe('buildGenericTagGeo (G2 N32)', () => {
  it('positions the tag box against the classifier\'s FINAL box width -- ' +
    'jar-verified `caboco-62-jula911` ("Param" on "Foo", boxWidth 95.475)', () => {
    const dim = { width: 39.325, height: 16, rawTextWidth: 35.325 };
    const geo = buildGenericTagGeo(['Param'], dim, 95.475, 'sans-serif', 9.8889);
    expect(geo.rectX).toBeCloseTo(61.15, 4); // 95.475 - 39.325 + 4 + 1
    expect(geo.rectY).toBe(-3); // -4 + 1
    expect(geo.rectWidth).toBeCloseTo(37.325, 4); // 39.325 - 2
    expect(geo.rectHeight).toBe(14); // 16 - 2
    expect(geo.textX).toBeCloseTo(62.15, 4); // rectX + 1
    expect(geo.textY).toBeCloseTo(7.8889, 4); // rectY + 1 + baselineOffset
    expect(geo.textWidth).toBe(35.325);
    expect(geo.text).toBe('Param');
    // Default font metadata (no override): 12pt, plain weight, always italic.
    expect(geo.fontSize).toBe(CLASS_STEREOTYPE_FONT_SIZE);
    expect(geo.bold).toBeUndefined();
    expect(geo.italic).toBe(true);
  });

  // G2 N39: `skinparam classStereotypeFontSize`/`FontStyle` overrides --
  // jar-verified `datugo-88-sote552` (`font-weight="700"`, NO `font-style`
  // attribute -- an explicit FontStyle REPLACES the default italic face).
  it('carries a theme-resolved fontSize/bold/italic override', () => {
    const dim = { width: 39.325, height: 16, rawTextWidth: 35.325 };
    const geo = buildGenericTagGeo(['Param'], dim, 95.475, 'Times', 9.8889, 20, true, false);
    expect(geo.fontFamily).toBe('Times');
    expect(geo.fontSize).toBe(20);
    expect(geo.bold).toBe(true);
    expect(geo.italic).toBe(false);
  });

  // G2 N49: `rawText` (`Classifier.typeParamsRawText`) overrides the
  // rendered `text` field verbatim -- see `measureGenericTagDim`'s own
  // sibling test for the jar-verified mechanism.
  it('renders the verbatim rawText override instead of typeParams.join when provided', () => {
    const dim = { width: 39.325, height: 16, rawTextWidth: 35.325 };
    const geo = buildGenericTagGeo(['K', 'V'], dim, 95.475, 'sans-serif', 9.8889, CLASS_STEREOTYPE_FONT_SIZE, false, true, 'K,V');
    expect(geo.text).toBe('K,V');
  });
});

describe('layoutClass — generic type-parameter tag box end-to-end (G2 N32)', () => {
  it('caboco-62-jula911: `class Foo<Param>` -- box widens by genericDim.width, ' +
    'tag box geometry byte-exact', () => {
    const ast = parse('class Foo<Param>');
    const det = new DeterministicMeasurer();
    const result = layoutClass(ast, defaultTheme, det);
    const geo = result.classifiers[0]!;
    expect(geo.width).toBeCloseTo(95.475, 4);
    expect(geo.genericTag).toBeDefined();
    expect(geo.genericTag?.text).toBe('Param');
    expect(geo.genericTag?.rectWidth).toBeCloseTo(37.325, 4);
    expect(geo.genericTag?.rectHeight).toBe(14);
  });

  it('a classifier with no type parameters gets no genericTag field ' +
    '(zero behavior change)', () => {
    const ast = parse('class Foo');
    const result = layoutClass(ast, defaultTheme, new DeterministicMeasurer());
    expect(result.classifiers[0]!.genericTag).toBeUndefined();
  });
});
