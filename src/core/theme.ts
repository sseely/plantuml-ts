/**
 * Theme system for plantuml-js.
 *
 * Defines the visual appearance of all diagram types via a single Theme
 * interface. The resolveTheme helper normalises string aliases and deep-merges
 * partial overrides without mutating the built-in theme objects.
 */

export interface Theme {
  fontFamily: string;
  fontSize: number;
  colors: {
    background: string;
    border: string;
    text: string;
    arrow: string;
    note: string;
    // NOTE: upstream default is '#FBFB77' (HColors.COL_FBFB77 in ColorParam.java).
    // This value intentionally diverges. Tracked in plans/skinparam/decision-journal.md.
    noteBackground: string;
    lifeline: string;
    activation: string;
    frame: string;
    divider: string;
    error: string;
    graph: {
      classBackground: string;
      interfaceBackground: string;
      enumBackground: string;
      actorStroke: string;
      packageBackground: string;
      packageBorder: string;
      edgeLabel: string;
    };
  };
  sequence: {
    /** Horizontal padding inside a participant box */
    participantPadding: number;
    /** Minimum participant box width */
    participantMinWidth: number;
    /** Horizontal gap between adjacent participant boxes */
    participantGap: number;
    /** Vertical gap between messages */
    messageSpacing: number;
    /** Width of the activation box drawn on a lifeline */
    activationWidth: number;
    /** Gap between a note and the nearest participant */
    noteMargin: number;
    /** Height of the frame label area */
    frameHeaderHeight: number;
    /** Extra lifeline length below the last message */
    lifelineExtension: number;
  };
}

export const defaultTheme: Theme = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 14,
  colors: {
    background: '#FFFFFF',
    border: '#181818',
    text: '#181818',
    arrow: '#181818',
    note: '#FEFECE',
    noteBackground: '#FEFECE',
    lifeline: '#181818',
    activation: '#DDDDDD',
    frame: '#999999',
    divider: '#999999',
    error: '#CC0000',
    graph: {
      classBackground: '#FEFECE',
      interfaceBackground: '#B4D7ED',
      enumBackground: '#FEFECE',
      actorStroke: '#181818',
      packageBackground: 'none',
      packageBorder: '#999999',
      edgeLabel: '#444444',
    },
  },
  sequence: {
    participantPadding: 10,
    participantMinWidth: 80,
    participantGap: 20,
    messageSpacing: 20,
    activationWidth: 10,
    noteMargin: 5,
    frameHeaderHeight: 20,
    lifelineExtension: 20,
  },
};

export const darkTheme: Theme = {
  fontFamily: defaultTheme.fontFamily,
  fontSize: defaultTheme.fontSize,
  colors: {
    background: '#1E1E1E',
    border: '#CCCCCC',
    text: '#CCCCCC',
    arrow: '#CCCCCC',
    note: '#3C3C3C',
    noteBackground: '#2D2D2D',
    lifeline: '#888888',
    activation: '#444444',
    frame: '#666666',
    divider: '#555555',
    error: defaultTheme.colors.error,
    graph: { ...defaultTheme.colors.graph },
  },
  sequence: { ...defaultTheme.sequence },
};

/**
 * Deep-merge a partial Theme on top of a base Theme.
 *
 * Returns a new Theme object — neither `base` nor `partial` is mutated.
 * Nested objects (`colors`, `colors.graph`, `sequence`) are merged one level
 * deep; scalar fields use nullish coalescing so that explicit `undefined`
 * falls through to the base value.
 */
export function deepMergeTheme(base: Theme, partial: Partial<Theme>): Theme {
  return {
    fontFamily: partial.fontFamily ?? base.fontFamily,
    fontSize: partial.fontSize ?? base.fontSize,
    colors: {
      ...base.colors,
      ...(partial.colors ?? {}),
      graph: {
        ...base.colors.graph,
        ...(partial.colors?.graph ?? {}),
      },
    },
    sequence: {
      ...base.sequence,
      ...(partial.sequence ?? {}),
    },
  };
}

/**
 * Resolve a theme option to a concrete Theme object.
 *
 * - String aliases: 'default' → defaultTheme, 'dark' → darkTheme,
 *   'sketchy' and 'monochrome' alias to defaultTheme for Phase 1.
 * - Partial<Theme> object: deep-merged on top of defaultTheme. The original
 *   defaultTheme is never mutated.
 * - undefined / omitted: returns defaultTheme.
 */
export function resolveTheme(
  option?: Partial<Theme> | 'default' | 'dark' | 'sketchy' | 'monochrome',
): Theme {
  if (option === undefined || option === 'default') {
    return defaultTheme;
  }

  if (option === 'dark') {
    return darkTheme;
  }

  // Phase-1 aliases — full styling deferred
  if (option === 'sketchy' || option === 'monochrome') {
    return defaultTheme;
  }

  // Partial<Theme> deep-merge — produce a new object, never mutate defaultTheme
  return deepMergeTheme(defaultTheme, option);
}
