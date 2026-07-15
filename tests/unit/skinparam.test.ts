import { describe, it, expect } from 'vitest';
import { resolveSkinparam, parseStyleBlock, resolveColor } from '../../src/core/skinparam.js';
import { defaultTheme, deepMergeTheme } from '../../src/core/theme.js';

// ---------------------------------------------------------------------------
// resolveSkinparam — direct key matches
// ---------------------------------------------------------------------------
describe('resolveSkinparam — direct key matches', () => {
  it('maps backgroundcolor to colors.background', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['backgroundcolor', '#FF0000']]),
      defaultTheme,
    );
    expect(theme.colors.background).toBe('#FF0000');
    expect(unknown).toEqual([]);
  });

  it('maps bordercolor to colors.border', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['bordercolor', '#AABBCC']]),
      defaultTheme,
    );
    expect(theme.colors.border).toBe('#AABBCC');
    expect(unknown).toEqual([]);
  });

  it('maps fontcolor to colors.text', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['fontcolor', '#112233']]),
      defaultTheme,
    );
    expect(theme.colors.text).toBe('#112233');
    expect(unknown).toEqual([]);
  });

  it('maps defaultfontcolor to colors.text', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['defaultfontcolor', '#223344']]),
      defaultTheme,
    );
    expect(theme.colors.text).toBe('#223344');
    expect(unknown).toEqual([]);
  });

  it('maps arrowcolor to colors.arrow', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['arrowcolor', '#334455']]),
      defaultTheme,
    );
    expect(theme.colors.arrow).toBe('#334455');
    expect(unknown).toEqual([]);
  });

  it('maps defaultarrowcolor to colors.arrow', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['defaultarrowcolor', '#445566']]),
      defaultTheme,
    );
    expect(theme.colors.arrow).toBe('#445566');
    expect(unknown).toEqual([]);
  });

  it('maps notebackgroundcolor to colors.noteBackground', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['notebackgroundcolor', '#FAFAFA']]),
      defaultTheme,
    );
    expect(theme.colors.noteBackground).toBe('#FAFAFA');
    expect(unknown).toEqual([]);
  });

  it('maps fontname to fontFamily', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['fontname', 'Courier New']]),
      defaultTheme,
    );
    expect(theme.fontFamily).toBe('Courier New');
    expect(unknown).toEqual([]);
  });

  it('maps defaultfontname to fontFamily (same as fontname)', () => {
    const { theme: t1 } = resolveSkinparam(
      new Map([['fontname', 'Georgia']]),
      defaultTheme,
    );
    const { theme: t2 } = resolveSkinparam(
      new Map([['defaultfontname', 'Georgia']]),
      defaultTheme,
    );
    expect(t1.fontFamily).toBe(t2.fontFamily);
  });

  it('maps fontsize to fontSize as number', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['fontsize', '18']]),
      defaultTheme,
    );
    expect(theme.fontSize).toBe(18);
    expect(unknown).toEqual([]);
  });

  it('maps defaultfontsize to fontSize (same as fontsize)', () => {
    const { theme: t1 } = resolveSkinparam(
      new Map([['fontsize', '16']]),
      defaultTheme,
    );
    const { theme: t2 } = resolveSkinparam(
      new Map([['defaultfontsize', '16']]),
      defaultTheme,
    );
    expect(t1.fontSize).toBe(t2.fontSize);
  });

  it('maps classbackgroundcolor to colors.graph.classBackground', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['classbackgroundcolor', '#AABBCC']]),
      defaultTheme,
    );
    expect(theme.colors.graph.classBackground).toBe('#AABBCC');
    expect(unknown).toEqual([]);
  });

  it('maps interfacebackgroundcolor to colors.graph.interfaceBackground', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['interfacebackgroundcolor', '#112233']]),
      defaultTheme,
    );
    expect(theme.colors.graph.interfaceBackground).toBe('#112233');
    expect(unknown).toEqual([]);
  });

  it('maps enumbackgroundcolor to colors.graph.enumBackground', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['enumbackgroundcolor', '#BBCCDD']]),
      defaultTheme,
    );
    expect(theme.colors.graph.enumBackground).toBe('#BBCCDD');
    expect(unknown).toEqual([]);
  });

  it('maps actorbordercolor to colors.graph.actorStroke', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['actorbordercolor', '#CCDDEE']]),
      defaultTheme,
    );
    expect(theme.colors.graph.actorStroke).toBe('#CCDDEE');
    expect(unknown).toEqual([]);
  });

  it('maps packagebackgroundcolor to colors.graph.packageBackground', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['packagebackgroundcolor', '#DDEEFF']]),
      defaultTheme,
    );
    expect(theme.colors.graph.packageBackground).toBe('#DDEEFF');
    expect(unknown).toEqual([]);
  });

  it('maps packagebordercolor to colors.graph.packageBorder', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['packagebordercolor', '#EEFF00']]),
      defaultTheme,
    );
    expect(theme.colors.graph.packageBorder).toBe('#EEFF00');
    expect(unknown).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resolveSkinparam — activity skinparam keys
// ---------------------------------------------------------------------------
describe('resolveSkinparam — activity skinparam keys', () => {
  it('maps ActivityBackgroundColor to colors.graph.activity.background', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['ActivityBackgroundColor', '#aabbcc']]),
      defaultTheme,
    );
    expect(theme.colors.graph.activity?.background).toBe('#aabbcc');
    expect(unknown).toEqual([]);
  });

  it('maps ActivityBorderColor to colors.graph.activity.border', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['ActivityBorderColor', '#001122']]),
      defaultTheme,
    );
    expect(theme.colors.graph.activity?.border).toBe('#001122');
    expect(unknown).toEqual([]);
  });

  it('maps ActivityBarColor to colors.graph.activity.barColor', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['ActivityBarColor', '#001122']]),
      defaultTheme,
    );
    expect(theme.colors.graph.activity?.barColor).toBe('#001122');
    expect(unknown).toEqual([]);
  });

  it('maps ActivityDiamondBackgroundColor to colors.graph.activity.diamondBackground', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['ActivityDiamondBackgroundColor', '#112233']]),
      defaultTheme,
    );
    expect(theme.colors.graph.activity?.diamondBackground).toBe('#112233');
    expect(unknown).toEqual([]);
  });

  it('maps ActivityDiamondForegroundColor to colors.graph.activity.diamondBorder', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['ActivityDiamondForegroundColor', '#ff0000']]),
      defaultTheme,
    );
    expect(theme.colors.graph.activity?.diamondBorder).toBe('#ff0000');
    expect(unknown).toEqual([]);
  });

  it('maps ActivityDiamondBorderColor to colors.graph.activity.diamondBorder', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['ActivityDiamondBorderColor', '#ff0000']]),
      defaultTheme,
    );
    expect(theme.colors.graph.activity?.diamondBorder).toBe('#ff0000');
    expect(unknown).toEqual([]);
  });

  it('maps ActivityStartColor to colors.graph.activity.startColor', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['ActivityStartColor', '#223344']]),
      defaultTheme,
    );
    expect(theme.colors.graph.activity?.startColor).toBe('#223344');
    expect(unknown).toEqual([]);
  });

  it('maps ActivityEndColor to colors.graph.activity.endColor', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['ActivityEndColor', '#334455']]),
      defaultTheme,
    );
    expect(theme.colors.graph.activity?.endColor).toBe('#334455');
    expect(unknown).toEqual([]);
  });

  it('maps SwimlaneHeaderBackgroundColor to colors.graph.activity.swimlaneBorder', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['SwimlaneHeaderBackgroundColor', '#334455']]),
      defaultTheme,
    );
    expect(theme.colors.graph.activity?.swimlaneBorder).toBe('#334455');
    expect(unknown).toEqual([]);
  });

  it('maps SwimlaneBorderColor to colors.graph.activity.swimlaneBorder', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['SwimlaneBorderColor', '#445566']]),
      defaultTheme,
    );
    expect(theme.colors.graph.activity?.swimlaneBorder).toBe('#445566');
    expect(unknown).toEqual([]);
  });

  it('unknown key WeirdKey still appears in result.unknown', () => {
    const { unknown } = resolveSkinparam(
      new Map([['WeirdKey', 'value']]),
      defaultTheme,
    );
    expect(unknown).toContain('weirdkey');
  });

  it('BackgroundColor still maps to colors.background (regression)', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['BackgroundColor', '#ffffff']]),
      defaultTheme,
    );
    expect(theme.colors.background).toBe('#ffffff');
    expect(unknown).toEqual([]);
  });

  it('activity subobject is undefined when no activity keys are set', () => {
    const { theme } = resolveSkinparam(
      new Map([['backgroundcolor', '#ffffff']]),
      defaultTheme,
    );
    // deepMergeTheme spreads activity from base (undefined) — result is an
    // empty object rather than undefined, but all fields are absent.
    const act = theme.colors.graph.activity;
    expect(act?.background).toBeUndefined();
    expect(act?.border).toBeUndefined();
  });

  it('preserves existing graph fields when only activity keys are set', () => {
    const { theme } = resolveSkinparam(
      new Map([['ActivityBackgroundColor', '#aabbcc']]),
      defaultTheme,
    );
    expect(theme.colors.graph.classBackground).toBe(
      defaultTheme.colors.graph.classBackground,
    );
    expect(theme.colors.graph.packageBorder).toBe(
      defaultTheme.colors.graph.packageBorder,
    );
  });
});

// ---------------------------------------------------------------------------
// deepMergeTheme — nested activity override
// ---------------------------------------------------------------------------
describe('deepMergeTheme — nested activity override', () => {
  it('merges activity.background without clobbering other graph fields', () => {
    const result = deepMergeTheme(defaultTheme, {
      colors: {
        ...defaultTheme.colors,
        graph: {
          ...defaultTheme.colors.graph,
          activity: { background: 'x' },
        },
      },
    });
    expect(result.colors.graph.activity?.background).toBe('x');
    expect(result.colors.graph.classBackground).toBe(
      defaultTheme.colors.graph.classBackground,
    );
    expect(result.colors.graph.packageBorder).toBe(
      defaultTheme.colors.graph.packageBorder,
    );
  });

  it('merges partial activity override without losing sibling activity fields', () => {
    // Start with a base that already has an activity subobject.
    const baseWithActivity = deepMergeTheme(defaultTheme, {
      colors: {
        ...defaultTheme.colors,
        graph: {
          ...defaultTheme.colors.graph,
          activity: { background: 'red', border: 'blue' },
        },
      },
    });
    // Merge in only a new border value.
    const result = deepMergeTheme(baseWithActivity, {
      colors: {
        ...baseWithActivity.colors,
        graph: {
          ...baseWithActivity.colors.graph,
          activity: { border: 'green' },
        },
      },
    });
    expect(result.colors.graph.activity?.border).toBe('green');
    expect(result.colors.graph.activity?.background).toBe('red');
  });
});

// ---------------------------------------------------------------------------
// resolveSkinparam — key normalisation
// ---------------------------------------------------------------------------
describe('resolveSkinparam — key normalisation', () => {
  it('normalises classArrowColor to arrowcolor (arrow prefix collapse)', () => {
    // "classArrowColor" → normalise → "arrowcolor" → maps to colors.arrow
    const { theme, unknown } = resolveSkinparam(
      new Map([['classArrowColor', '#AAAAAA']]),
      defaultTheme,
    );
    expect(theme.colors.arrow).toBe('#AAAAAA');
    expect(unknown).toEqual([]);
  });

  it('normalises sequenceArrowColor to arrowcolor (same slot as classArrowColor)', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['sequenceArrowColor', '#BBBBBB']]),
      defaultTheme,
    );
    expect(theme.colors.arrow).toBe('#BBBBBB');
    expect(unknown).toEqual([]);
  });

  it('classarrowcolor and sequencearrowcolor map to the same property as arrowcolor', () => {
    const { theme: t1 } = resolveSkinparam(
      new Map([['arrowcolor', '#CCCCCC']]),
      defaultTheme,
    );
    const { theme: t2 } = resolveSkinparam(
      new Map([['classarrowcolor', '#CCCCCC']]),
      defaultTheme,
    );
    const { theme: t3 } = resolveSkinparam(
      new Map([['sequencearrowcolor', '#CCCCCC']]),
      defaultTheme,
    );
    expect(t1.colors.arrow).toBe(t2.colors.arrow);
    expect(t2.colors.arrow).toBe(t3.colors.arrow);
  });

  it('strips underscores: class_background_color → classbackgroundcolor', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['class_background_color', '#AABBCC']]),
      defaultTheme,
    );
    expect(theme.colors.graph.classBackground).toBe('#AABBCC');
    expect(unknown).toEqual([]);
  });

  it('strips dots from key', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['class.background.color', '#AABBCC']]),
      defaultTheme,
    );
    expect(theme.colors.graph.classBackground).toBe('#AABBCC');
    expect(unknown).toEqual([]);
  });

  it('normalises sequenceParticipantBackgroundColor to participantbackgroundcolor (unknown)', () => {
    // "sequenceParticipantBackgroundColor" → lower → strip underscores →
    // collapse "sequenceparticipant" prefix → "participantbackgroundcolor"
    // No Theme slot for this — goes to unknown[]
    const { unknown } = resolveSkinparam(
      new Map([['sequenceParticipantBackgroundColor', '#FFCCDD']]),
      defaultTheme,
    );
    expect(unknown).toContain('participantbackgroundcolor');
  });

  it('normalises sequenceMessageAlign to sequencemessagealignment', () => {
    // "align" suffix → "alignment"
    const { unknown } = resolveSkinparam(
      new Map([['sequenceMessageAlign', 'left']]),
      defaultTheme,
    );
    // No Theme slot — goes to unknown
    expect(unknown).toContain('sequencemessagealignment');
  });

  it('normalises participantbackgroundcolor to unknown (no Theme slot)', () => {
    const { unknown } = resolveSkinparam(
      new Map([['participantbackgroundcolor', '#FFCCDD']]),
      defaultTheme,
    );
    expect(unknown).toContain('participantbackgroundcolor');
  });
});

// ---------------------------------------------------------------------------
// resolveSkinparam — unknown keys
// ---------------------------------------------------------------------------
describe('resolveSkinparam — unknown keys', () => {
  it('collects an unrecognised key in unknown[]', () => {
    const { unknown } = resolveSkinparam(
      new Map([['handwritten', 'true']]),
      defaultTheme,
    );
    expect(unknown).toContain('handwritten');
  });

  it('does not throw for unknown keys', () => {
    expect(() =>
      resolveSkinparam(new Map([['totally_unknown_key', 'value']]), defaultTheme),
    ).not.toThrow();
  });

  it('collects stereotype-qualified key in unknown[] without throwing', () => {
    expect(() =>
      resolveSkinparam(
        new Map([['classBackgroundColor<<Foo>>', '#AABBCC']]),
        defaultTheme,
      ),
    ).not.toThrow();
    const { unknown } = resolveSkinparam(
      new Map([['classBackgroundColor<<Foo>>', '#AABBCC']]),
      defaultTheme,
    );
    expect(unknown.some((k) => k.includes('<<'))).toBe(true);
  });

  it('unknown[] is empty when all keys are recognised', () => {
    const { unknown } = resolveSkinparam(
      new Map([
        ['backgroundcolor', '#FF0000'],
        ['fontname', 'Arial'],
        ['fontsize', '14'],
      ]),
      defaultTheme,
    );
    expect(unknown).toEqual([]);
  });

  it('mixes known and unknown keys correctly', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([
        ['backgroundcolor', '#FF0000'],
        ['handwritten', 'true'],
        ['shadowing', 'false'],
      ]),
      defaultTheme,
    );
    expect(theme.colors.background).toBe('#FF0000');
    expect(unknown).toContain('handwritten');
    expect(unknown).toContain('shadowing');
    expect(unknown).not.toContain('backgroundcolor');
  });
});

// ---------------------------------------------------------------------------
// resolveSkinparam — base theme and no-mutation guarantee
// ---------------------------------------------------------------------------
describe('resolveSkinparam — base theme behaviour', () => {
  it('retains all unaffected base values when one key is set', () => {
    const { theme } = resolveSkinparam(
      new Map([['backgroundcolor', '#FF0000']]),
      defaultTheme,
    );
    expect(theme.fontFamily).toBe(defaultTheme.fontFamily);
    expect(theme.fontSize).toBe(defaultTheme.fontSize);
    expect(theme.colors.border).toBe(defaultTheme.colors.border);
    expect(theme.colors.text).toBe(defaultTheme.colors.text);
    expect(theme.colors.arrow).toBe(defaultTheme.colors.arrow);
    expect(theme.colors.graph.classBackground).toBe(defaultTheme.colors.graph.classBackground);
    expect(theme.sequence.participantPadding).toBe(defaultTheme.sequence.participantPadding);
  });

  it('does not mutate the base theme', () => {
    const originalBg = defaultTheme.colors.background;
    resolveSkinparam(new Map([['backgroundcolor', '#FF0000']]), defaultTheme);
    expect(defaultTheme.colors.background).toBe(originalBg);
  });

  it('returns a new theme object (not the base reference)', () => {
    const { theme } = resolveSkinparam(
      new Map([['backgroundcolor', '#FF0000']]),
      defaultTheme,
    );
    expect(theme).not.toBe(defaultTheme);
  });

  it('works with an empty skinparam map — returns equivalent of base', () => {
    const { theme, unknown } = resolveSkinparam(new Map(), defaultTheme);
    expect(theme.fontFamily).toBe(defaultTheme.fontFamily);
    expect(theme.fontSize).toBe(defaultTheme.fontSize);
    expect(theme.colors.background).toBe(defaultTheme.colors.background);
    expect(unknown).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseStyleBlock — StyleMap structure
// ---------------------------------------------------------------------------
describe('parseStyleBlock', () => {
  it('returns empty StyleMap for empty string', () => {
    const result = parseStyleBlock('');
    expect(result.size).toBe(0);
  });

  it('parses a declaration inside a selector block under the selector key', () => {
    const result = parseStyleBlock('actor { BackGroundColor: blue; }');
    expect(result.get('actor')).toBeDefined();
    expect(result.get('actor')!.get('backgroundcolor')).toBe('blue');
  });

  it('strips trailing semicolons from values', () => {
    const result = parseStyleBlock('actor { BackGroundColor: blue; }');
    expect(result.get('actor')!.get('backgroundcolor')).toBe('blue');
  });

  it('stores nested selector as dot-separated path', () => {
    const result = parseStyleBlock('actor {\n  business {\n    BackGroundColor: red;\n  }\n}');
    expect(result.get('actor.business')).toBeDefined();
    expect(result.get('actor.business')!.get('backgroundcolor')).toBe('red');
  });

  it('stores bare top-level declarations under empty-string key', () => {
    const result = parseStyleBlock('BackGroundColor: green;');
    expect(result.get('')).toBeDefined();
    expect(result.get('')!.get('backgroundcolor')).toBe('green');
  });

  it('handles mixed selector and bare declarations', () => {
    const raw = 'BackGroundColor: green;\nactor {\n  BackGroundColor: blue;\n}';
    const result = parseStyleBlock(raw);
    expect(result.get('')!.get('backgroundcolor')).toBe('green');
    expect(result.get('actor')!.get('backgroundcolor')).toBe('blue');
  });

  it('lowercases selector names in paths', () => {
    const result = parseStyleBlock('Actor {\n  BackGroundColor: red\n}');
    expect(result.get('actor')).toBeDefined();
    expect(result.get('Actor')).toBeUndefined();
  });

  it('lowercases property keys', () => {
    const result = parseStyleBlock('element {\n  BackgroundColor: #FF0000\n}');
    expect(result.get('element')!.has('backgroundcolor')).toBe(true);
    expect(result.get('element')!.has('BackgroundColor')).toBe(false);
  });

  it('trims whitespace from values', () => {
    const result = parseStyleBlock('element {\n  color:   #AABBCC   \n}');
    expect(result.get('element')!.get('color')).toBe('#AABBCC');
  });

  it('parses multiple declarations under the same selector', () => {
    const raw = 'element {\n  backgroundColor: red\n  fontColor: blue\n  fontSize: 14\n}';
    const result = parseStyleBlock(raw);
    const inner = result.get('element')!;
    expect(inner.get('backgroundcolor')).toBe('red');
    expect(inner.get('fontcolor')).toBe('blue');
    expect(inner.get('fontsize')).toBe('14');
    expect(inner.size).toBe(3);
  });

  it('handles multiple selector blocks — each gets its own path', () => {
    const raw = [
      'element {',
      '  backgroundColor: red',
      '}',
      'note {',
      '  backgroundColor: yellow',
      '}',
    ].join('\n');
    const result = parseStyleBlock(raw);
    expect(result.get('element')!.get('backgroundcolor')).toBe('red');
    expect(result.get('note')!.get('backgroundcolor')).toBe('yellow');
  });

  it('silently skips bare single-token lines (no value follows)', () => {
    const result = parseStyleBlock('element {\n  justAWord\n  color: blue\n}');
    const inner = result.get('element')!;
    expect(inner.get('color')).toBe('blue');
    expect(inner.size).toBe(1);
  });

  it('parses space-separated key value syntax (colon optional per upstream)', () => {
    const result = parseStyleBlock('actor {\n  BackGroundColor blue\n}');
    expect(result.get('actor')!.get('backgroundcolor')).toBe('blue');
  });

  it('parses space-separated syntax with semicolon terminator', () => {
    const result = parseStyleBlock('actor {\n  BackGroundColor blue;\n}');
    expect(result.get('actor')!.get('backgroundcolor')).toBe('blue');
  });

  it('parses mixed colon and space-separated declarations in same block', () => {
    const result = parseStyleBlock('actor {\n  BackGroundColor blue\n  FontColor: red\n}');
    const inner = result.get('actor')!;
    expect(inner.get('backgroundcolor')).toBe('blue');
    expect(inner.get('fontcolor')).toBe('red');
  });

  it('handles hyphenated property names', () => {
    const result = parseStyleBlock('element {\n  font-size: 16\n}');
    expect(result.get('element')!.get('font-size')).toBe('16');
  });

  it('handles value with colons (e.g. hex after colon)', () => {
    // Only first colon splits key/value; rest stays in value
    const result = parseStyleBlock('element {\n  color: rgb(255:0:0)\n}');
    expect(result.get('element')!.get('color')).toBe('rgb(255:0:0)');
  });

  it('returns empty StyleMap for block with only selector and closing brace', () => {
    const result = parseStyleBlock('element {\n}');
    expect(result.size).toBe(0);
  });

  it('handles windows-style CRLF line endings correctly', () => {
    const result = parseStyleBlock('element {\r\n  color: blue\r\n}\r\n');
    expect(result.get('element')!.get('color')).toBe('blue');
  });

  it('does not include the selector path itself as a property key', () => {
    const result = parseStyleBlock('element {\n  color: blue\n}');
    expect(result.has('element')).toBe(true);
    // The selector-path key maps to a declarations map, not a string
    expect(result.get('element') instanceof Map).toBe(true);
  });

  it('parses 3-level nesting (e.g. jsonDiagram.node.separator)', () => {
    const raw = 'jsonDiagram {\n  node {\n    separator {\n      LineColor black\n    }\n  }\n}';
    const result = parseStyleBlock(raw);
    expect(result.get('jsondiagram.node.separator')?.get('linecolor')).toBe('black');
  });

  it('value without trailing semicolon is stored as-is', () => {
    const result = parseStyleBlock('actor { BackGroundColor: blue }');
    expect(result.get('actor')!.get('backgroundcolor')).toBe('blue');
  });

  it('stores entries from multiple parses independently', () => {
    const r1 = parseStyleBlock('actor { BackGroundColor: blue; }');
    const r2 = parseStyleBlock('actor { BackGroundColor: red; }');
    expect(r1.get('actor')!.get('backgroundcolor')).toBe('blue');
    expect(r2.get('actor')!.get('backgroundcolor')).toBe('red');
  });

  it('preserves semicolons inside quoted values (e.g. LineStyle "1;5")', () => {
    const raw = 'yamlDiagram {\n  node {\n    separator {\n      LineStyle "1;5"\n    }\n  }\n}';
    const result = parseStyleBlock(raw);
    expect(result.get('yamldiagram.node.separator')?.get('linestyle')).toBe('1;5');
  });

  it('strips double-quotes from quoted values', () => {
    const result = parseStyleBlock('actor { LineStyle "5 3" }');
    expect(result.get('actor')!.get('linestyle')).toBe('5 3');
  });
});

// ---------------------------------------------------------------------------
// resolveColor — gradient syntax stripping
// ---------------------------------------------------------------------------
describe('resolveColor', () => {
  it('returns plain named colors unchanged', () => {
    expect(resolveColor('red')).toBe('red');
    expect(resolveColor('blue')).toBe('blue');
    expect(resolveColor('white')).toBe('white');
  });

  it('returns plain hex colors unchanged', () => {
    expect(resolveColor('#AABBCC')).toBe('#AABBCC');
    expect(resolveColor('#fff')).toBe('#fff');
  });

  it('strips gradient — returns end color for hex-name gradients', () => {
    expect(resolveColor('#AAAAAA-white')).toBe('white');
    expect(resolveColor('#AAAAAA-red')).toBe('red');
  });

  it('strips gradient — returns end color for name-name gradients', () => {
    expect(resolveColor('gray-white')).toBe('white');
  });

  it('strips gradient — returns end color for hex-hex gradients', () => {
    expect(resolveColor('#AAAAAA-#FF0000')).toBe('#FF0000');
  });

  it('applies to backgroundColor skinparam with gradient', () => {
    const params = new Map([['backgroundColor', '#AAAAAA-white']]);
    const { theme } = resolveSkinparam(params, defaultTheme);
    expect(theme.colors.background).toBe('white');
  });

  it('applies to activityBackgroundColor skinparam with gradient', () => {
    const params = new Map([['activityBackgroundColor', '#AAAAAA-red']]);
    const { theme } = resolveSkinparam(params, defaultTheme);
    expect(theme.colors.graph.activity?.background).toBe('red');
  });
});

// ---------------------------------------------------------------------------
// resolveSkinparam — per-element buckets + gradient parsing (T4 / D1, D4)
// ---------------------------------------------------------------------------
describe('resolveSkinparam — element buckets + gradients', () => {
  it('routes a gradient databaseBackgroundColor into the database bucket as a Gradient (AC1)', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['databaseBackgroundColor', '#FFd8f4\\#FF92d1']]),
      defaultTheme,
    );
    expect(theme.colors.elements?.database?.background).toEqual({
      color1: '#FFd8f4',
      color2: '#FF92d1',
      policy: '\\',
    });
    expect(unknown).toEqual([]);
  });

  it('keeps classBackgroundColor in the class field, not the database bucket (AC2)', () => {
    const { theme } = resolveSkinparam(
      new Map([['classBackgroundColor', '#FEFECE']]),
      defaultTheme,
    );
    expect(theme.colors.graph.classBackground).toBe('#FEFECE');
    expect(theme.colors.elements?.database).toBeUndefined();
  });

  it('stores a solid element color as a plain string Paint, not a Gradient (AC3)', () => {
    const { theme } = resolveSkinparam(
      new Map([['componentBackgroundColor', '#123456']]),
      defaultTheme,
    );
    expect(theme.colors.elements?.component?.background).toBe('#123456');
  });

  it('routes border and font element keys into the same bucket', () => {
    const { theme } = resolveSkinparam(
      new Map([
        ['nodeBackgroundColor', '#111111'],
        ['nodeBorderColor', '#222222'],
        ['nodeFontColor', '#333333'],
      ]),
      defaultTheme,
    );
    expect(theme.colors.elements?.node).toEqual({
      background: '#111111',
      border: '#222222',
      font: '#333333',
    });
  });

  it('does not treat a non-bucket element name as a bucket key', () => {
    // `widgetBackgroundColor` is not a known bucket SName → stays unknown.
    const { theme, unknown } = resolveSkinparam(
      new Map([['widgetBackgroundColor', '#abcdef']]),
      defaultTheme,
    );
    expect(theme.colors.elements).toBeUndefined();
    expect(unknown).toContain('widgetbackgroundcolor');
  });
});

// ---------------------------------------------------------------------------
// resolveSkinparam — per-element FontSize / StereotypeFontSize (G1 I4b)
// ---------------------------------------------------------------------------
describe('resolveSkinparam — element font-size buckets (G1 I4b)', () => {
  it('routes componentFontSize/interfaceFontSize into their own buckets (cukafa-49-fona812)', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([
        ['componentFontSize', '18'],
        ['interfaceFontSize', '18'],
      ]),
      defaultTheme,
    );
    expect(theme.colors.elements?.component?.fontSize).toBe(18);
    expect(theme.colors.elements?.interface?.fontSize).toBe(18);
    expect(unknown).toEqual([]);
  });

  it('routes packageFontSize (block form) into the package bucket (xagino-11-vazo768)', () => {
    const { theme } = resolveSkinparam(
      new Map([['packagefontsize', '40']]),
      defaultTheme,
    );
    expect(theme.colors.elements?.package?.fontSize).toBe(40);
  });

  it('routes nodeStereotypeFontSize into the node bucket, distinct from fontSize (mavicu-17-mago821)', () => {
    const { theme } = resolveSkinparam(
      new Map([['nodestereotypefontsize', '20']]),
      defaultTheme,
    );
    expect(theme.colors.elements?.node?.stereotypeFontSize).toBe(20);
    expect(theme.colors.elements?.node?.fontSize).toBeUndefined();
  });

  it('does not confuse databaseStereotypeFontSize with databaseFontSize', () => {
    const { theme } = resolveSkinparam(
      new Map([
        ['databasefontsize', '11'],
        ['databasestereotypefontsize', '22'],
      ]),
      defaultTheme,
    );
    expect(theme.colors.elements?.database).toEqual({ fontSize: 11, stereotypeFontSize: 22 });
  });

  it('non-numeric font-size values are recorded as unknown, not silently dropped', () => {
    const { theme, unknown } = resolveSkinparam(
      new Map([['componentfontsize', 'not-a-number']]),
      defaultTheme,
    );
    expect(theme.colors.elements).toBeUndefined();
    expect(unknown).toContain('componentfontsize');
  });
});
