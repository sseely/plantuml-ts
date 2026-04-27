import { describe, it, expect } from 'vitest';
import { resolveSkinparam, parseStyleBlock } from '../../src/core/skinparam.js';
import { defaultTheme } from '../../src/core/theme.js';

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

  it('silently skips lines with no colon separator inside a block', () => {
    const result = parseStyleBlock('element {\n  justAWord\n  color: blue\n}');
    const inner = result.get('element')!;
    expect(inner.get('color')).toBe('blue');
    expect(inner.size).toBe(1);
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

  it('throws when nesting depth exceeds 2 levels', () => {
    const raw = 'a {\n  b {\n    c {\n      color: red\n    }\n  }\n}';
    expect(() => parseStyleBlock(raw)).toThrow('style nesting depth > 2 not supported');
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
});
