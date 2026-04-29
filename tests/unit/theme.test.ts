import { describe, it, expect } from 'vitest';
import {
  defaultTheme,
  darkTheme,
  sketchyTheme,
  monochromeTheme,
  resolveTheme,
  deepMergeTheme,
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
    expect(typeof g.actorFill).toBe('string');
    expect(typeof g.usecaseFill).toBe('string');
    expect(typeof g.businessActorFill).toBe('string');
    expect(typeof g.businessUsecaseFill).toBe('string');
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

  it('graph.actorFill is none', () => {
    expect(defaultTheme.colors.graph.actorFill).toBe('none');
  });

  it('graph.businessActorFill is none', () => {
    expect(defaultTheme.colors.graph.businessActorFill).toBe('none');
  });

  it('graph.usecaseFill equals colors.background', () => {
    expect(defaultTheme.colors.graph.usecaseFill).toBe(
      defaultTheme.colors.background,
    );
  });

  it('graph.businessUsecaseFill equals colors.background', () => {
    expect(defaultTheme.colors.graph.businessUsecaseFill).toBe(
      defaultTheme.colors.background,
    );
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
    expect(typeof g.actorFill).toBe('string');
    expect(typeof g.usecaseFill).toBe('string');
    expect(typeof g.businessActorFill).toBe('string');
    expect(typeof g.businessUsecaseFill).toBe('string');
  });

  it('graph fields are non-empty strings', () => {
    const g = darkTheme.colors.graph;
    for (const [key, val] of Object.entries(g)) {
      if (typeof val !== 'string') continue; // skip nested subobjects (e.g. activity)
      expect(typeof val, `graph.${key} should be string`).toBe('string');
      expect(val.length, `graph.${key} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it('graph.actorFill is none', () => {
    expect(darkTheme.colors.graph.actorFill).toBe('none');
  });

  it('graph.businessActorFill is none', () => {
    expect(darkTheme.colors.graph.businessActorFill).toBe('none');
  });

  it('graph.usecaseFill equals darkTheme colors.background', () => {
    expect(darkTheme.colors.graph.usecaseFill).toBe(darkTheme.colors.background);
  });

  it('graph.businessUsecaseFill equals darkTheme colors.background', () => {
    expect(darkTheme.colors.graph.businessUsecaseFill).toBe(
      darkTheme.colors.background,
    );
  });
});

// ---------------------------------------------------------------------------
// sketchyTheme
// ---------------------------------------------------------------------------
describe('sketchyTheme', () => {
  it('has all four new graph fill properties as non-undefined strings', () => {
    const g = sketchyTheme.colors.graph;
    expect(typeof g.actorFill).toBe('string');
    expect(typeof g.usecaseFill).toBe('string');
    expect(typeof g.businessActorFill).toBe('string');
    expect(typeof g.businessUsecaseFill).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// monochromeTheme
// ---------------------------------------------------------------------------
describe('monochromeTheme', () => {
  it('has all four new graph fill properties as non-undefined strings', () => {
    const g = monochromeTheme.colors.graph;
    expect(typeof g.actorFill).toBe('string');
    expect(typeof g.usecaseFill).toBe('string');
    expect(typeof g.businessActorFill).toBe('string');
    expect(typeof g.businessUsecaseFill).toBe('string');
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

  it('returns sketchyTheme when called with "sketchy"', () => {
    expect(resolveTheme('sketchy')).toBe(sketchyTheme);
  });

  it('returns monochromeTheme when called with "monochrome"', () => {
    expect(resolveTheme('monochrome')).toBe(monochromeTheme);
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
        graph: {
          classBackground: '#FF0000',
          interfaceBackground: '#B4D7ED',
          enumBackground: '#FEFECE',
          actorStroke: '#181818',
          packageBackground: 'none',
          packageBorder: '#999999',
          edgeLabel: '#444444',
          actorFill: 'none',
          usecaseFill: '#FFFFFF',
          businessActorFill: 'none',
          businessUsecaseFill: '#FFFFFF',
        },
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
    expect(result.colors.graph.actorFill).toBe(defaultTheme.colors.graph.actorFill);
    expect(result.colors.graph.usecaseFill).toBe(defaultTheme.colors.graph.usecaseFill);
    expect(result.colors.graph.businessActorFill).toBe(defaultTheme.colors.graph.businessActorFill);
    expect(result.colors.graph.businessUsecaseFill).toBe(defaultTheme.colors.graph.businessUsecaseFill);
  });

  it('deep-merges partial graph actorFill override while retaining all other graph defaults', () => {
    const partial: Partial<Theme> = {
      colors: {
        graph: { actorFill: '#0000FF' },
      } as Theme['colors'],
    };
    const result = deepMergeTheme(defaultTheme, partial);
    expect(result.colors.graph.actorFill).toBe('#0000FF');
    expect(result.colors.graph.classBackground).toBe(defaultTheme.colors.graph.classBackground);
    expect(result.colors.graph.interfaceBackground).toBe(defaultTheme.colors.graph.interfaceBackground);
    expect(result.colors.graph.enumBackground).toBe(defaultTheme.colors.graph.enumBackground);
    expect(result.colors.graph.actorStroke).toBe(defaultTheme.colors.graph.actorStroke);
    expect(result.colors.graph.packageBackground).toBe(defaultTheme.colors.graph.packageBackground);
    expect(result.colors.graph.packageBorder).toBe(defaultTheme.colors.graph.packageBorder);
    expect(result.colors.graph.edgeLabel).toBe(defaultTheme.colors.graph.edgeLabel);
    expect(result.colors.graph.usecaseFill).toBe(defaultTheme.colors.graph.usecaseFill);
    expect(result.colors.graph.businessActorFill).toBe(defaultTheme.colors.graph.businessActorFill);
    expect(result.colors.graph.businessUsecaseFill).toBe(defaultTheme.colors.graph.businessUsecaseFill);
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

// ---------------------------------------------------------------------------
// deepMergeTheme
// ---------------------------------------------------------------------------
describe('deepMergeTheme', () => {
  const customBase: Theme = {
    fontFamily: 'Georgia',
    fontSize: 12,
    colors: {
      background: '#AAAAAA',
      nodeBackground: '#A1A1A1',
      border: '#BBBBBB',
      text: '#CCCCCC',
      arrow: '#DDDDDD',
      note: '#EEEEEE',
      noteBackground: '#111111',
      lifeline: '#222222',
      activation: '#333333',
      frame: '#444444',
      divider: '#555555',
      error: '#FF0000',
      graph: {
        classBackground: '#0A0A0A',
        interfaceBackground: '#1A1A1A',
        enumBackground: '#2A2A2A',
        actorStroke: '#3A3A3A',
        packageBackground: '#4A4A4A',
        packageBorder: '#5A5A5A',
        edgeLabel: '#6A6A6A',
        actorFill: '#7A7A7A',
        usecaseFill: '#8A8A8A',
        businessActorFill: '#9A9A9A',
        businessUsecaseFill: '#AAAAAB',
      },
    },
    sequence: {
      participantPadding: 5,
      participantMinWidth: 60,
      participantGap: 15,
      messageSpacing: 10,
      activationWidth: 8,
      noteMargin: 3,
      frameHeaderHeight: 18,
      lifelineExtension: 12,
    },
  };

  it('overrides background in a partial merge over a custom base', () => {
    const result = deepMergeTheme(customBase, { colors: { background: '#FF0000' } as Theme['colors'] });
    expect(result.colors.background).toBe('#FF0000');
  });

  it('retains all base values not present in partial', () => {
    const result = deepMergeTheme(customBase, { colors: { background: '#FF0000' } as Theme['colors'] });
    expect(result.fontFamily).toBe(customBase.fontFamily);
    expect(result.fontSize).toBe(customBase.fontSize);
    expect(result.colors.border).toBe(customBase.colors.border);
    expect(result.colors.text).toBe(customBase.colors.text);
    expect(result.colors.arrow).toBe(customBase.colors.arrow);
    expect(result.colors.note).toBe(customBase.colors.note);
    expect(result.colors.noteBackground).toBe(customBase.colors.noteBackground);
    expect(result.colors.lifeline).toBe(customBase.colors.lifeline);
    expect(result.colors.activation).toBe(customBase.colors.activation);
    expect(result.colors.frame).toBe(customBase.colors.frame);
    expect(result.colors.divider).toBe(customBase.colors.divider);
    expect(result.colors.error).toBe(customBase.colors.error);
    expect(result.colors.graph.classBackground).toBe(customBase.colors.graph.classBackground);
    expect(result.colors.graph.interfaceBackground).toBe(customBase.colors.graph.interfaceBackground);
    expect(result.colors.graph.enumBackground).toBe(customBase.colors.graph.enumBackground);
    expect(result.colors.graph.actorStroke).toBe(customBase.colors.graph.actorStroke);
    expect(result.colors.graph.packageBackground).toBe(customBase.colors.graph.packageBackground);
    expect(result.colors.graph.packageBorder).toBe(customBase.colors.graph.packageBorder);
    expect(result.colors.graph.edgeLabel).toBe(customBase.colors.graph.edgeLabel);
    expect(result.colors.graph.actorFill).toBe(customBase.colors.graph.actorFill);
    expect(result.colors.graph.usecaseFill).toBe(customBase.colors.graph.usecaseFill);
    expect(result.colors.graph.businessActorFill).toBe(customBase.colors.graph.businessActorFill);
    expect(result.colors.graph.businessUsecaseFill).toBe(customBase.colors.graph.businessUsecaseFill);
    expect(result.sequence.participantPadding).toBe(customBase.sequence.participantPadding);
    expect(result.sequence.participantMinWidth).toBe(customBase.sequence.participantMinWidth);
  });

  it('does not mutate the base theme', () => {
    const originalBackground = customBase.colors.background;
    const originalClassBg = customBase.colors.graph.classBackground;
    deepMergeTheme(customBase, {
      colors: {
        background: '#FF0000',
        graph: { classBackground: '#00FF00' },
      } as Theme['colors'],
    });
    expect(customBase.colors.background).toBe(originalBackground);
    expect(customBase.colors.graph.classBackground).toBe(originalClassBg);
  });

  it('merges partial graph override while retaining other graph fields from base', () => {
    const result = deepMergeTheme(customBase, {
      colors: {
        graph: { classBackground: '#BEEF00' },
      } as Theme['colors'],
    });
    expect(result.colors.graph.classBackground).toBe('#BEEF00');
    expect(result.colors.graph.interfaceBackground).toBe(customBase.colors.graph.interfaceBackground);
    expect(result.colors.graph.enumBackground).toBe(customBase.colors.graph.enumBackground);
    expect(result.colors.graph.actorStroke).toBe(customBase.colors.graph.actorStroke);
    expect(result.colors.graph.packageBackground).toBe(customBase.colors.graph.packageBackground);
    expect(result.colors.graph.packageBorder).toBe(customBase.colors.graph.packageBorder);
    expect(result.colors.graph.edgeLabel).toBe(customBase.colors.graph.edgeLabel);
    expect(result.colors.graph.actorFill).toBe(customBase.colors.graph.actorFill);
    expect(result.colors.graph.usecaseFill).toBe(customBase.colors.graph.usecaseFill);
    expect(result.colors.graph.businessActorFill).toBe(customBase.colors.graph.businessActorFill);
    expect(result.colors.graph.businessUsecaseFill).toBe(customBase.colors.graph.businessUsecaseFill);
  });

  it('merges sequence fields from partial over custom base', () => {
    const result = deepMergeTheme(customBase, {
      sequence: {
        participantPadding: 50,
        participantMinWidth: 60,
        participantGap: 15,
        messageSpacing: 10,
        activationWidth: 8,
        noteMargin: 3,
        frameHeaderHeight: 18,
        lifelineExtension: 12,
      },
    });
    expect(result.sequence.participantPadding).toBe(50);
    expect(result.sequence.participantMinWidth).toBe(customBase.sequence.participantMinWidth);
  });

  it('returns a new object, not the base reference', () => {
    const result = deepMergeTheme(customBase, {});
    expect(result).not.toBe(customBase);
  });

  it('merges fontFamily from partial', () => {
    const result = deepMergeTheme(customBase, { fontFamily: 'Verdana' });
    expect(result.fontFamily).toBe('Verdana');
    expect(result.fontSize).toBe(customBase.fontSize);
  });

  it('merges fontSize from partial', () => {
    const result = deepMergeTheme(customBase, { fontSize: 20 });
    expect(result.fontSize).toBe(20);
    expect(result.fontFamily).toBe(customBase.fontFamily);
  });
});
