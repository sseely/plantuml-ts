import { describe, it, expect } from 'vitest';
import {
  createAnnotations,
  isEmpty,
  isDisplayPositionedNull,
  matchAnnotationCommand,
  type DiagramAnnotations,
} from '../../src/core/annotations/index.js';
import { HorizontalAlignment } from '../../src/core/klimt/geom/HorizontalAlignment.js';
import { VerticalAlignment } from '../../src/core/klimt/geom/VerticalAlignment.js';

function match(lines: readonly string[], i = 0, a: DiagramAnnotations = createAnnotations()) {
  const result = matchAnnotationCommand(lines, i, a);
  return { result, a };
}

// ---------------------------------------------------------------------------
// createAnnotations / isEmpty defaults
// ---------------------------------------------------------------------------

describe('createAnnotations', () => {
  it('builds the six none() defaults matching TitledDiagram field defaults', () => {
    const a = createAnnotations();
    expect(a.title.horizontalAlignment).toBe(HorizontalAlignment.CENTER);
    expect(a.title.verticalAlignment).toBe(VerticalAlignment.TOP);
    expect(a.caption.horizontalAlignment).toBe(HorizontalAlignment.CENTER);
    expect(a.caption.verticalAlignment).toBe(VerticalAlignment.BOTTOM);
    expect(a.legend.horizontalAlignment).toBe(HorizontalAlignment.CENTER);
    expect(a.legend.verticalAlignment).toBe(VerticalAlignment.BOTTOM);
    expect(a.header.horizontalAlignment).toBe(HorizontalAlignment.CENTER);
    expect(a.header.verticalAlignment).toBeNull();
    expect(a.footer.horizontalAlignment).toBe(HorizontalAlignment.CENTER);
    expect(a.footer.verticalAlignment).toBeNull();
    expect(a.mainFrame.horizontalAlignment).toBeNull();
    expect(a.mainFrame.verticalAlignment).toBeNull();
  });

  it('is isEmpty() before any command is matched', () => {
    expect(isEmpty(createAnnotations())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// title (single-line)
// ---------------------------------------------------------------------------

describe('title (single-line)', () => {
  it('matches bare unquoted text, CENTER/TOP, consumed 1', () => {
    const { result, a } = match(['title Hello World']);
    expect(result).toEqual({ consumed: 1 });
    expect(a.title.display).toEqual(['Hello World']);
    expect(a.title.horizontalAlignment).toBe(HorizontalAlignment.CENTER);
    expect(a.title.verticalAlignment).toBe(VerticalAlignment.TOP);
    expect(isEmpty(a)).toBe(false);
  });

  it('matches a quoted value, stripping the quotes', () => {
    const { a } = match(['title "quoted"']);
    expect(a.title.display).toEqual(['quoted']);
  });

  it('matches the colon separator form', () => {
    const { a } = match(['title : colon form']);
    expect(a.title.display).toEqual(['colon form']);
  });

  it('rejects a whitespace-only quoted title (consumed, but not set)', () => {
    const { result, a } = match(['title "   "']);
    expect(result).toEqual({ consumed: 1 });
    expect(isDisplayPositionedNull(a.title)).toBe(true);
  });

  it('rejects an unquoted value with no letter/digit/underscore/dot', () => {
    const { result } = match(['title !!!']);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// title (multiline)
// ---------------------------------------------------------------------------

describe('title (multiline)', () => {
  it('consumes through "end title" inclusive', () => {
    const { result, a } = match(['title', 'line one', 'line two', 'end title']);
    expect(result).toEqual({ consumed: 4 });
    expect(a.title.display).toEqual(['line one', 'line two']);
    expect(a.title.horizontalAlignment).toBe(HorizontalAlignment.CENTER);
    expect(a.title.verticalAlignment).toBe(VerticalAlignment.TOP);
  });

  it('also closes on "endtitle" (no space)', () => {
    const { result, a } = match(['title', 'line one', 'endtitle']);
    expect(result).toEqual({ consumed: 3 });
    expect(a.title.display).toEqual(['line one']);
  });

  it('strips the common leading-whitespace column (removeEmptyColumns)', () => {
    const { a } = match(['title', '  foo', '  bar', 'end title']);
    expect(a.title.display).toEqual(['foo', 'bar']);
  });

  it('converts literal backslash-t to a real tab (replaceBackslashT)', () => {
    const { a } = match(['title', 'a\\tb', 'end title']);
    expect(a.title.display).toEqual(['a\tb']);
  });

  it('returns null when no end marker is ever found', () => {
    const { result } = match(['title', 'line one']);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// caption
// ---------------------------------------------------------------------------

describe('caption', () => {
  it('single-line: CENTER/BOTTOM', () => {
    const { a } = match(['caption a nice caption']);
    expect(a.caption.display).toEqual(['a nice caption']);
    expect(a.caption.horizontalAlignment).toBe(HorizontalAlignment.CENTER);
    expect(a.caption.verticalAlignment).toBe(VerticalAlignment.BOTTOM);
  });

  it('multiline: consumes through end caption', () => {
    const { result, a } = match(['caption', 'body', 'end caption']);
    expect(result).toEqual({ consumed: 3 });
    expect(a.caption.display).toEqual(['body']);
  });

  it('has no reject-null-or-white guard (unlike title)', () => {
    const { a } = match(['caption "   "']);
    // setCaption is unconditional upstream: a whitespace-only display IS stored.
    expect(isDisplayPositionedNull(a.caption)).toBe(false);
    expect(a.caption.display).toEqual(['   ']);
  });
});

// ---------------------------------------------------------------------------
// legend
// ---------------------------------------------------------------------------

describe('legend', () => {
  it('multiline "legend top right ... end legend" -> TOP/RIGHT', () => {
    const { result, a } = match(['legend top right', 'body', 'end legend']);
    expect(result).toEqual({ consumed: 3 });
    expect(a.legend.display).toEqual(['body']);
    expect(a.legend.horizontalAlignment).toBe(HorizontalAlignment.RIGHT);
    expect(a.legend.verticalAlignment).toBe(VerticalAlignment.TOP);
  });

  it('bare "legend" + body defaults to CENTER/BOTTOM', () => {
    const { a } = match(['legend', 'body', 'end legend']);
    expect(a.legend.horizontalAlignment).toBe(HorizontalAlignment.CENTER);
    expect(a.legend.verticalAlignment).toBe(VerticalAlignment.BOTTOM);
  });

  it('"legend: one-liner" single-line form works, CENTER/BOTTOM, no options', () => {
    const { result, a } = match(['legend: one-liner']);
    expect(result).toEqual({ consumed: 1 });
    expect(a.legend.display).toEqual(['one-liner']);
    expect(a.legend.horizontalAlignment).toBe(HorizontalAlignment.CENTER);
    expect(a.legend.verticalAlignment).toBe(VerticalAlignment.BOTTOM);
  });

  it('unterminated "legend top right" (no end legend) falls back to single-line', () => {
    // No 'end legend' anywhere -> MultilinesLegend fails to match -> the
    // single-line Legend command (next in priority) reads the whole
    // remainder as literal text, CENTER/BOTTOM, no options parsing.
    const { result, a } = match(['legend top right']);
    expect(result).toEqual({ consumed: 1 });
    expect(a.legend.display).toEqual(['top right']);
    expect(a.legend.horizontalAlignment).toBe(HorizontalAlignment.CENTER);
    expect(a.legend.verticalAlignment).toBe(VerticalAlignment.BOTTOM);
  });
});

// ---------------------------------------------------------------------------
// header / footer
// ---------------------------------------------------------------------------

describe('header', () => {
  it('"left header foo" stores alignment LEFT', () => {
    const { result, a } = match(['left header foo']);
    expect(result).toEqual({ consumed: 1 });
    expect(a.header.display).toEqual(['foo']);
    expect(a.header.horizontalAlignment).toBe(HorizontalAlignment.LEFT);
  });

  it('bare "header x2" leaves alignment null (style default deferred to draw time)', () => {
    const { a } = match(['header x2']);
    expect(a.header.display).toEqual(['x2']);
    expect(a.header.horizontalAlignment).toBeNull();
  });

  it('"header:" with no value does not match', () => {
    const { result } = match(['header:']);
    expect(result).toBeNull();
  });

  it('multiline: trims each body line individually, no column-stripping', () => {
    const { result, a } = match(['header', '  indented  ', 'end header']);
    expect(result).toEqual({ consumed: 3 });
    expect(a.header.display).toEqual(['indented']);
  });

  it('multiline: does NOT convert backslash-t (asymmetric with title/caption/legend)', () => {
    const { a } = match(['header', 'a\\tb', 'end header']);
    expect(a.header.display).toEqual(['a\\tb']);
  });

  it('multiline start accepts a position prefix with zero spaces (left header quirk)', () => {
    const { result, a } = match(['left header', 'foo', 'end header']);
    expect(result).toEqual({ consumed: 3 });
    expect(a.header.horizontalAlignment).toBe(HorizontalAlignment.LEFT);
  });
});

describe('footer', () => {
  it('"center footer bar" stores alignment CENTER', () => {
    const { a } = match(['center footer bar']);
    expect(a.footer.display).toEqual(['bar']);
    expect(a.footer.horizontalAlignment).toBe(HorizontalAlignment.CENTER);
  });

  it('quoted value form strips quotes', () => {
    const { a } = match(['footer "quoted footer"']);
    expect(a.footer.display).toEqual(['quoted footer']);
  });

  it('colon separator form works', () => {
    const { a } = match(['footer: colon footer']);
    expect(a.footer.display).toEqual(['colon footer']);
  });

  it('multiline: consumes through end footer, alignment from prefix', () => {
    const { result, a } = match(['right footer', 'bottom text', 'end footer']);
    expect(result).toEqual({ consumed: 3 });
    expect(a.footer.display).toEqual(['bottom text']);
    expect(a.footer.horizontalAlignment).toBe(HorizontalAlignment.RIGHT);
  });
});

// ---------------------------------------------------------------------------
// mainframe
// ---------------------------------------------------------------------------

describe('mainframe', () => {
  it('parses into mainFrame with both alignments null', () => {
    const { result, a } = match(['mainframe My Frame Title']);
    expect(result).toEqual({ consumed: 1 });
    expect(a.mainFrame.display).toEqual(['My Frame Title']);
    expect(a.mainFrame.horizontalAlignment).toBeNull();
    expect(a.mainFrame.verticalAlignment).toBeNull();
  });

  it('colon separator form works', () => {
    const { a } = match(['mainframe: colon frame']);
    expect(a.mainFrame.display).toEqual(['colon frame']);
  });

  it('has no quoted-value alternative (quotes are kept literally)', () => {
    const { a } = match(['mainframe "kept"']);
    expect(a.mainFrame.display).toEqual(['"kept"']);
  });

  it('rejects a value with no letter/digit/underscore/dot', () => {
    const { result } = match(['mainframe !!!']);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Non-matches
// ---------------------------------------------------------------------------

describe('non-annotation lines', () => {
  it('returns null and mutates nothing for an unrelated command', () => {
    const before = createAnnotations();
    const { result, a } = match(['titleize this'], 0, before);
    expect(result).toBeNull();
    expect(isEmpty(a)).toBe(true);
  });

  it('returns null for a plain diagram line', () => {
    const { result } = match(['Alice -> Bob : hello']);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// matchAnnotationCommand: mid-array line index
// ---------------------------------------------------------------------------

describe('matchAnnotationCommand at a non-zero index', () => {
  it('matches at the given index and records it as location', () => {
    const lines = ['@startuml', 'title Positioned', 'Alice -> Bob'];
    const { result, a } = match(lines, 1);
    expect(result).toEqual({ consumed: 1 });
    expect(a.title.location).toBe(1);
  });

  it('multiline block consumed count is relative to the block, not absolute', () => {
    const lines = ['@startuml', 'title', 'body', 'end title', 'Alice -> Bob'];
    const { result } = match(lines, 1);
    expect(result).toEqual({ consumed: 3 });
  });
});

// ---------------------------------------------------------------------------
// Display-line escape splitting (getWithNewlines-lite: \n / \t / \\)
// ---------------------------------------------------------------------------

describe('single-line value escape splitting', () => {
  it('splits on a literal backslash-n into multiple display lines', () => {
    const { a } = match(['title line1\\nline2']);
    expect(a.title.display).toEqual(['line1', 'line2']);
  });

  it('converts a literal backslash-t to a real tab', () => {
    const { a } = match(['title a\\tb']);
    expect(a.title.display).toEqual(['a\tb']);
  });

  it('converts a literal double-backslash to a single backslash', () => {
    const { a } = match(['title a\\\\b']);
    expect(a.title.display).toEqual(['a\\b']);
  });

  it('keeps an unrecognized backslash escape verbatim', () => {
    const { a } = match(['title a\\xb']);
    expect(a.title.display).toEqual(['a\\xb']);
  });

  it('keeps a trailing lone backslash verbatim', () => {
    const { a } = match(['title ab\\']);
    expect(a.title.display).toEqual(['ab\\']);
  });
});

// ---------------------------------------------------------------------------
// horizontalAlignmentFromString / verticalAlignmentFromString (model.ts)
// ---------------------------------------------------------------------------

describe('horizontalAlignmentFromString', () => {
  it('parses LEFT/CENTER/RIGHT case-insensitively', async () => {
    const { horizontalAlignmentFromString } = await import('../../src/core/annotations/model.js');
    expect(horizontalAlignmentFromString('left')).toBe(HorizontalAlignment.LEFT);
    expect(horizontalAlignmentFromString('Center')).toBe(HorizontalAlignment.CENTER);
    expect(horizontalAlignmentFromString('RIGHT')).toBe(HorizontalAlignment.RIGHT);
  });

  it('returns null for null/undefined/unrecognized input', async () => {
    const { horizontalAlignmentFromString } = await import('../../src/core/annotations/model.js');
    expect(horizontalAlignmentFromString(null)).toBeNull();
    expect(horizontalAlignmentFromString(undefined)).toBeNull();
    expect(horizontalAlignmentFromString('diagonal')).toBeNull();
  });
});

describe('horizontalAlignmentFromStringOrDefault', () => {
  it('falls back to the default for null/undefined/unrecognized input', async () => {
    const { horizontalAlignmentFromStringOrDefault } = await import('../../src/core/annotations/model.js');
    expect(horizontalAlignmentFromStringOrDefault(null, HorizontalAlignment.RIGHT)).toBe(
      HorizontalAlignment.RIGHT,
    );
    expect(horizontalAlignmentFromStringOrDefault(undefined, HorizontalAlignment.CENTER)).toBe(
      HorizontalAlignment.CENTER,
    );
    expect(horizontalAlignmentFromStringOrDefault('diagonal', HorizontalAlignment.LEFT)).toBe(
      HorizontalAlignment.LEFT,
    );
  });

  it('returns the parsed alignment when recognized', async () => {
    const { horizontalAlignmentFromStringOrDefault } = await import('../../src/core/annotations/model.js');
    expect(horizontalAlignmentFromStringOrDefault('left', HorizontalAlignment.RIGHT)).toBe(
      HorizontalAlignment.LEFT,
    );
  });
});

describe('verticalAlignmentFromString', () => {
  it('parses "top" case-insensitively to TOP', async () => {
    const { verticalAlignmentFromString } = await import('../../src/core/annotations/model.js');
    expect(verticalAlignmentFromString('Top')).toBe(VerticalAlignment.TOP);
  });

  it('defaults everything else, including null/undefined, to BOTTOM', async () => {
    const { verticalAlignmentFromString } = await import('../../src/core/annotations/model.js');
    expect(verticalAlignmentFromString('bottom')).toBe(VerticalAlignment.BOTTOM);
    expect(verticalAlignmentFromString('center')).toBe(VerticalAlignment.BOTTOM);
    expect(verticalAlignmentFromString(null)).toBe(VerticalAlignment.BOTTOM);
    expect(verticalAlignmentFromString(undefined)).toBe(VerticalAlignment.BOTTOM);
  });
});

// ---------------------------------------------------------------------------
// Out-of-range line index (public-boundary defensive default)
// ---------------------------------------------------------------------------

describe('matchAnnotationCommand with an out-of-range index', () => {
  it('returns null rather than throwing when i is beyond lines.length', () => {
    const { result, a } = match(['legend'], 5);
    expect(result).toBeNull();
    expect(isEmpty(a)).toBe(true);
  });
});
