/**
 * Theme system for plantuml-ts.
 *
 * Defines the visual appearance of all diagram types via a single Theme
 * interface. The resolveTheme helper normalises string aliases and deep-merges
 * partial overrides without mutating the built-in theme objects.
 */

import { BUILTIN_THEMES } from './themes-builtin.js';

export interface Theme {
  fontFamily: string;
  fontSize: number;
  colors: {
    background: string;
    /** Default fill for action/node shapes (separate from canvas background). */
    nodeBackground: string;
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
      // NOTE: upstream actor head (via Fashion.apply in ActorStickMan.java) inherits
      // the root skin BackgroundColor (#f1f1f1 via --common-background). Current
      // renderer hardcodes fill="none" for the head circle. Divergence preserved
      // intentionally to match existing rendering behavior.
      actorFill: string;
      // NOTE: upstream usecase ellipse (USymbolUsecase.java) inherits root
      // BackgroundColor (#f1f1f1). Current renderer uses theme.colors.background
      // (#FFFFFF in default theme). Divergence preserved intentionally.
      usecaseFill: string;
      // Same divergence note as actorFill; business variant of stickman actor
      // (USymbolActorBusiness.java / ActorStickMan with isBusiness=true).
      businessActorFill: string;
      // Same divergence note as usecaseFill; business variant of usecase ellipse
      // (USymbolUsecase.java with isBusiness=true).
      businessUsecaseFill: string;
      activity?: {
        background?: string;        // ActivityBackgroundColor — action box fill
        border?: string;            // ActivityBorderColor — action box stroke
        barColor?: string;          // ActivityBarColor — fork/join bar fill
        diamondBackground?: string; // ActivityDiamondBackgroundColor
        diamondBorder?: string;     // ActivityDiamondBorderColor
        startColor?: string;        // ActivityStartColor — filled start circle
        endColor?: string;          // ActivityEndColor — end/terminate circle
        swimlaneBorder?: string;    // SwimlaneHeaderBackgroundColor — lane header
      };
      json?: {
        keyText?: string;
        stringValue?: string;
        numberValue?: string;
        booleanValue?: string;
        nullValue?: string;
        background?: string;
        border?: string;
        headerBackground?: string;
        highlightBackground?: string;
        arrowColor?: string;
        /** True when element.header { FontStyle: bold } is set. */
        headerFontBold?: boolean;
        // jsonDiagram { node { … } } style block properties
        /** Border rx (rounded corners) from jsonDiagram.node.RoundCorner */
        roundCorner?: number;
        /** Maximum value-column pixel width before word-wrap kicks in */
        maximumWidth?: number;
        /** Text alignment within cells: left (default), center, or right */
        textAlign?: 'left' | 'center' | 'right';
        /** Border stroke width from jsonDiagram.node.LineThickness */
        nodeLineThickness?: number;
        /** Value-cell font color from jsonDiagram.node.FontColor */
        nodeFontColor?: string;
        /** Value-cell font size from jsonDiagram.node.FontSize */
        nodeFontSize?: number;
        /** Value-cell font family from jsonDiagram.node.FontName */
        nodeFontFamily?: string;
        /** Bold override from jsonDiagram.node.FontStyle/FontWeight */
        nodeFontBold?: boolean;
        /** Italic override from jsonDiagram.node.FontStyle */
        nodeFontItalic?: boolean;
        /** Dash pattern for the outer node border (from jsonDiagram.node.LineStyle) */
        nodeLineDasharray?: string;
        // jsonDiagram { arrow { … } }
        /** Arrow/edge stroke width from jsonDiagram.arrow.LineThickness */
        arrowThickness?: number;
        /** Arrow/edge dash pattern from jsonDiagram.arrow.LineStyle */
        arrowDasharray?: string;
        // jsonDiagram { node { separator { … } } }
        /** Separator line color (overrides border for row dividers) */
        separatorColor?: string;
        /** Separator line thickness */
        separatorThickness?: number;
        /** Separator line dash pattern */
        separatorDasharray?: string;
        // jsonDiagram { node { highlight { … } } }
        /** Highlighted row font color */
        highlightFontColor?: string;
        /** Highlighted row font bold */
        highlightFontBold?: boolean;
        /** Highlighted row font italic */
        highlightFontItalic?: boolean;
        /** Per-class highlight overrides keyed by style class name (e.g. "h1") */
        highlightClasses?: Record<string, {
          background?: string;
          fontColor?: string;
          fontBold?: boolean;
          fontItalic?: boolean;
        }>;
      };
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
    nodeBackground: '#F1F1F1',
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
      actorFill: 'none',
      usecaseFill: '#FFFFFF',
      businessActorFill: 'none',
      businessUsecaseFill: '#FFFFFF',
      json: {
        // keyText is intentionally absent so the renderer's fallback chain
        // reaches nodeFontColor (from jsonDiagram.node.FontColor style blocks).
        // Themes that want an explicit key color set it directly (e.g. darkTheme).
        stringValue:         '#3A6E96',
        numberValue:         '#A67F52',
        booleanValue:        '#BE5D47',
        nullValue:           '#767676',
        // plantuml.skin sets jsonDiagram.node.BackGroundColor #F1F1F1 as the default.
        // Named themes override this via their compiled graph.json entry.
        background:          '#F1F1F1',
        border:              '#181818',
        highlightBackground: '#CCFF02',
        arrowColor:          '#181818',
      },
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
    nodeBackground: '#2D2D2D',
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
    graph: {
      ...defaultTheme.colors.graph,
      usecaseFill: '#1E1E1E',
      businessUsecaseFill: '#1E1E1E',
      json: {
        keyText:             '#CCCCCC',
        stringValue:         '#6A9FBF',
        numberValue:         '#C9985A',
        booleanValue:        '#D47070',
        nullValue:           '#999999',
        background:          '#2D2D2D',
        border:              '#CCCCCC',
        headerBackground:    '#3C3C3C',
        highlightBackground: '#555500',
        arrowColor:          '#CCCCCC',
      },
    },
  },
  sequence: { ...defaultTheme.sequence },
};

export const sketchyTheme: Theme = {
  ...defaultTheme,
};

export const monochromeTheme: Theme = {
  ...defaultTheme,
};

/**
 * Deep-partial theme override, safe to compose onto a base Theme.
 *
 * Unlike Partial<Theme> (which is only one level deep), colors and its nested
 * fields may each be partially specified. deepMergeTheme accepts this type and
 * fills missing fields from the base.
 */
export type ThemeOverride = {
  fontFamily?: string;
  fontSize?: number;
  colors?: {
    background?: string;
    nodeBackground?: string;
    border?: string;
    text?: string;
    arrow?: string;
    note?: string;
    noteBackground?: string;
    lifeline?: string;
    activation?: string;
    frame?: string;
    divider?: string;
    error?: string;
    graph?: Partial<Theme['colors']['graph']> & {
      activity?: Partial<NonNullable<Theme['colors']['graph']['activity']>>;
      json?: Partial<NonNullable<Theme['colors']['graph']['json']>>;
    };
  };
  sequence?: Partial<Theme['sequence']>;
};

/**
 * Deep-merge a partial Theme on top of a base Theme.
 *
 * Returns a new Theme object — neither `base` nor `partial` is mutated.
 * Nested objects (`colors`, `colors.graph`, `colors.graph.activity`,
 * `colors.graph.json`, `sequence`) are merged one level deep; scalar fields
 * use nullish coalescing so that explicit `undefined` falls through to the
 * base value.
 */
export function deepMergeTheme(base: Theme, partial: ThemeOverride): Theme {
  return {
    fontFamily: partial.fontFamily ?? base.fontFamily,
    fontSize: partial.fontSize ?? base.fontSize,
    colors: {
      ...base.colors,
      ...(partial.colors ?? {}),
      graph: {
        ...base.colors.graph,
        ...(partial.colors?.graph ?? {}),
        activity: {
          ...(base.colors.graph.activity ?? {}),
          ...(partial.colors?.graph?.activity ?? {}),
        },
        json: {
          ...(base.colors.graph.json ?? {}),
          ...(partial.colors?.graph?.json ?? {}),
        },
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
 *   'sketchy' → sketchyTheme, 'monochrome' → monochromeTheme.
 * - Any other string: looked up in BUILTIN_THEMES, merged onto defaultTheme.
 *   Unknown names fall back to defaultTheme.
 * - ThemeOverride object: deep-merged on top of defaultTheme. The original
 *   defaultTheme is never mutated.
 * - undefined / omitted: returns defaultTheme.
 */
export function resolveTheme(
  option?: ThemeOverride | string,
): Theme {
  if (option === undefined || option === 'default') {
    return defaultTheme;
  }

  if (option === 'dark') {
    return darkTheme;
  }

  if (option === 'sketchy') {
    return sketchyTheme;
  }

  if (option === 'monochrome') {
    return monochromeTheme;
  }

  if (typeof option === 'string') {
    const builtin = BUILTIN_THEMES[option];
    if (builtin !== undefined) return deepMergeTheme(defaultTheme, builtin);
    return defaultTheme;
  }

  // Partial<Theme> deep-merge — produce a new object, never mutate defaultTheme
  return deepMergeTheme(defaultTheme, option);
}
