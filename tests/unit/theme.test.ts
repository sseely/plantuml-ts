import { describe, it, expect } from 'vitest';
import {
  defaultTheme,
  darkTheme,
  resolveTheme,
} from '../../src/core/theme.js';
import type { Theme } from '../../src/core/theme.js';

// ---------------------------------------------------------------------------
// defaultTheme
// ---------------------------------------------------------------------------
describe('defaultTheme', () => {
  it('has a fontFamily string', () => {
    expect(typeof defaultTheme.fontFamily).toBe('string');
    expect(defaultTheme.fontFamily.length).toBeGreaterThan(0);
  });

  it('has a positive fontSize', () => {
    expect(defaultTheme.fontSize).toBeGreaterThan(0);
  });

  it('has all required top-level color fields', () => {
    const c = defaultTheme.colors;
    expect(typeof c.background).toBe('string');
    expect(typeof c.border).toBe('string');
    expect(typeof c.text).toBe('string');
    expect(typeof c.arrow).toBe('string');
    expect(typeof c.note).toBe('string');
    expect(typeof c.noteBackground).toBe('string');
    expect(typeof c.lifeline).toBe('string');
    expect(typeof c.activation).toBe('string');
    expect(typeof c.frame).toBe('string');
    expect(typeof c.divider).toBe('string');
    expect(typeof c.error).toBe('string');
  });

  it('has all required graph color fields', () => {
    const g = defaultTheme.colors.graph;
    expect(typeof g.classBackground).toBe('string');
    expect(typeof g.interfaceBackground).toBe('string');
    expect(typeof g.enumBackground).toBe('string');
    expect(typeof g.actorStroke).toBe('string');
    expect(typeof g.packageBackground).toBe('string');
    expect(typeof g.packageBorder).toBe('string');
    expect(typeof g.edgeLabel).toBe('string');
  });

  it('graph.classBackground is #FEFECE', () => {
    expect(defaultTheme.colors.graph.classBackground).toBe('#FEFECE');
  });

  it('graph.interfaceBackground is #B4D7ED', () => {
    expect(defaultTheme.colors.graph.interfaceBackground).toBe('#B4D7ED');
  });

  it('graph.enumBackground is #FEFECE', () => {
    expect(defaultTheme.colors.graph.enumBackground).toBe('#FEFECE');
  });

  it('graph.actorStroke is #181818', () => {
    expect(defaultTheme.colors.graph.actorStroke).toBe('#181818');
  });

  it('graph.packageBackground is none', () => {
    expect(defaultTheme.colors.graph.packageBackground).toBe('none');
  });

  it('graph.packageBorder is #999999', () => {
    expect(defaultTheme.colors.graph.packageBorder).toBe('#999999');
  });

  it('graph.edgeLabel is #444444', () => {
    expect(defaultTheme.colors.graph.edgeLabel).toBe('#444444');
  });

  it('has all required sequence fields', () => {
    const s = defaultTheme.sequence;
    expect(typeof s.participantPadding).toBe('number');
    expect(typeof s.participantMinWidth).toBe('number');
    expect(typeof s.participantGap).toBe('number');
    expect(typeof s.messageSpacing).toBe('number');
    expect(typeof s.activationWidth).toBe('number');
    expect(typeof s.noteMargin).toBe('number');
    expect(typeof s.frameHeaderHeight).toBe('number');
    expect(typeof s.lifelineExtension).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// darkTheme
// ---------------------------------------------------------------------------
describe('darkTheme', () => {
  it('has a dark background color', () => {
    expect(darkTheme.colors.background).not.toBe(defaultTheme.colors.background);
  });

  it('has all required graph color fields', () => {
    const g = darkTheme.colors.graph;
    expect(typeof g.classBackground).toBe('string');
    expect(typeof g.interfaceBackground).toBe('string');
    expect(typeof g.enumBackground).toBe('string');
    expect(typeof g.actorStroke).toBe('string');
    expect(typeof g.packageBackground).toBe('string');
    expect(typeof g.packageBorder).toBe('string');
    expect(typeof g.edgeLabel).toBe('string');
  });

  it('graph fields are non-empty strings', () => {
    const g = darkTheme.colors.graph;
    for (const [key, val] of Object.entries(g)) {
      expect(typeof val, `graph.${key} should be string`).toBe('string');
      expect(val.length, `graph.${key} should be non-empty`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// resolveTheme
// ---------------------------------------------------------------------------
describe('resolveTheme', () => {
  it('returns defaultTheme when called with no argument', () => {
    expect(resolveTheme()).toBe(defaultTheme);
  });

  it('returns defaultTheme when called with "default"', () => {
    expect(resolveTheme('default')).toBe(defaultTheme);
  });

  it('returns darkTheme when called with "dark"', () => {
    expect(resolveTheme('dark')).toBe(darkTheme);
  });

  it('returns defaultTheme when called with "sketchy"', () => {
    expect(resolveTheme('sketchy')).toBe(defaultTheme);
  });

  it('returns defaultTheme when called with "monochrome"', () => {
    expect(resolveTheme('monochrome')).toBe(defaultTheme);
  });

  it('dark theme has a defined non-empty graph.classBackground', () => {
    const result = resolveTheme('dark');
    expect(result.colors.graph.classBackground).toBeTruthy();
  });

  it('default theme graph.classBackground is #FEFECE', () => {
    const result = resolveTheme('default');
    expect(result.colors.graph.classBackground).toBe('#FEFECE');
  });

  it('merges partial theme over defaultTheme', () => {
    const partial: Partial<Theme> = { fontFamily: 'Courier New' };
    const result = resolveTheme(partial);
    expect(result.fontFamily).toBe('Courier New');
    expect(result.fontSize).toBe(defaultTheme.fontSize);
  });

  it('does not mutate defaultTheme when merging partial', () => {
    const originalBg = defaultTheme.colors.background;
    resolveTheme({ colors: { ...defaultTheme.colors, background: '#FF0000', graph: { ...defaultTheme.colors.graph } } });
    expect(defaultTheme.colors.background).toBe(originalBg);
  });

  it('merges partial colors.graph.classBackground and retains other graph defaults', () => {
    const partial: Partial<Theme> = {
      colors: {
        ...defaultTheme.colors,
        graph: { classBackground: '#FF0000', interfaceBackground: '#B4D7ED', enumBackground: '#FEFECE', actorStroke: '#181818', packageBackground: 'none', packageBorder: '#999999', edgeLabel: '#444444' },
      },
    };
    const result = resolveTheme(partial);
    expect(result.colors.graph.classBackground).toBe('#FF0000');
    expect(result.colors.graph.interfaceBackground).toBe('#B4D7ED');
    expect(result.colors.graph.enumBackground).toBe('#FEFECE');
    expect(result.colors.graph.actorStroke).toBe('#181818');
  });

  it('deep-merges partial graph override: only classBackground changes, others retain defaults', () => {
    const partial: Partial<Theme> = {
      colors: {
        graph: { classBackground: '#FF0000' },
      } as Theme['colors'],
    };
    const result = resolveTheme(partial);
    expect(result.colors.graph.classBackground).toBe('#FF0000');
    expect(result.colors.graph.interfaceBackground).toBe(defaultTheme.colors.graph.interfaceBackground);
    expect(result.colors.graph.enumBackground).toBe(defaultTheme.colors.graph.enumBackground);
    expect(result.colors.graph.actorStroke).toBe(defaultTheme.colors.graph.actorStroke);
    expect(result.colors.graph.packageBackground).toBe(defaultTheme.colors.graph.packageBackground);
    expect(result.colors.graph.packageBorder).toBe(defaultTheme.colors.graph.packageBorder);
    expect(result.colors.graph.edgeLabel).toBe(defaultTheme.colors.graph.edgeLabel);
  });

  it('merges sequence partial fields', () => {
    const partial: Partial<Theme> = { sequence: { participantPadding: 99, participantMinWidth: 80, participantGap: 20, messageSpacing: 20, activationWidth: 10, noteMargin: 5, frameHeaderHeight: 20, lifelineExtension: 20 } };
    const result = resolveTheme(partial);
    expect(result.sequence.participantPadding).toBe(99);
    expect(result.sequence.participantMinWidth).toBe(defaultTheme.sequence.participantMinWidth);
  });

  it('produces a new object (does not return defaultTheme reference) when merging', () => {
    const result = resolveTheme({ fontFamily: 'Verdana' });
    expect(result).not.toBe(defaultTheme);
  });
});
