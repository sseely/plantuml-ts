# T6 — Theme + Measurer

## Context

Project: plantuml-js — TypeScript PlantUML renderer producing SVG in browser.
Stack: TypeScript 5 strict, Vitest for tests.

The theme system defines colors, fonts, and spacing for all diagram types.
The measurer system provides text dimension calculation used by all layout
engines. Both are injected dependencies — nothing imports concrete implementations
except the public API entry point and tests.

## Task

Implement `src/core/theme.ts`, `src/core/measurer.ts`, and tests using TDD.
Write each test first, then implement.

## Write-set

| File | Action |
|------|--------|
| `src/core/theme.ts` | Create |
| `src/core/measurer.ts` | Create |
| `tests/unit/measurer.test.ts` | Create |

## Read-set

- `planning/tdd-plan.md` — section `tests/unit/measurer.test.ts`
- `planning/architecture.md` — section "Theming"
- `planning/decisions.md` — D4 (StringMeasurer interface, three implementations)

## Interface contracts

### Theme

```typescript
// src/core/theme.ts

export interface Theme {
  fontFamily: string;
  fontSize: number;
  colors: {
    background: string;
    border: string;
    text: string;
    arrow: string;
    note: string;
    noteBackground: string;
    lifeline: string;
    activation: string;
    frame: string;
    divider: string;
    error: string;
  };
  sequence: {
    participantPadding: number;   // horizontal padding inside participant box
    participantMinWidth: number;  // minimum participant box width
    messageSpacing: number;       // vertical gap between messages
    activationWidth: number;      // width of activation box on lifeline
    noteMargin: number;           // gap between note and participant
    frameHeaderHeight: number;    // height of frame label area
    lifelineExtension: number;    // extra lifeline below last message
  };
}

export const defaultTheme: Theme;
export const darkTheme: Theme;

export function resolveTheme(
  option?: Partial<Theme> | 'default' | 'dark' | 'sketchy' | 'monochrome'
): Theme;
```

**defaultTheme values:**
- fontFamily: `"Arial, sans-serif"`
- fontSize: `14`
- colors.background: `"#FFFFFF"`
- colors.border: `"#181818"`
- colors.text: `"#181818"`
- colors.arrow: `"#181818"`
- colors.note: `"#FEFECE"`
- colors.noteBackground: `"#FEFECE"`
- colors.lifeline: `"#181818"`
- colors.activation: `"#DDDDDD"`
- colors.frame: `"#999999"`
- colors.divider: `"#999999"`
- colors.error: `"#CC0000"`
- sequence.participantPadding: `10`
- sequence.participantMinWidth: `80`
- sequence.messageSpacing: `20`
- sequence.activationWidth: `10`
- sequence.noteMargin: `5`
- sequence.frameHeaderHeight: `20`
- sequence.lifelineExtension: `20`

**darkTheme**: same structure, override colors only:
- background: `"#1E1E1E"`, border: `"#CCCCCC"`, text: `"#CCCCCC"`,
  arrow: `"#CCCCCC"`, note: `"#3C3C3C"`, noteBackground: `"#2D2D2D"`,
  lifeline: `"#888888"`, activation: `"#444444"`, frame: `"#666666"`,
  divider: `"#555555"`

`resolveTheme('sketchy')` and `resolveTheme('monochrome')` may alias to
defaultTheme for Phase 1 — full styling is deferred.

### StringMeasurer

```typescript
// src/core/measurer.ts

export interface FontSpec {
  family: string;
  size: number;
  weight?: 'normal' | 'bold';
  style?: 'normal' | 'italic';
}

export interface StringMeasurer {
  measure(text: string, font: FontSpec): { width: number; height: number };
}

// Formula-based: width = text.length * size * 0.55, height = size * 1.2
export class FormulaMeasurer implements StringMeasurer {
  measure(text: string, font: FontSpec): { width: number; height: number };
}

// Canvas-based: uses CanvasRenderingContext2D.measureText (browser only)
export class CanvasMeasurer implements StringMeasurer {
  measure(text: string, font: FontSpec): { width: number; height: number };
}

// Fixed-width: every character has the same fixed width (for tests)
export class FixedMeasurer implements StringMeasurer {
  constructor(charWidth: number, lineHeight: number);
  measure(text: string, font: FontSpec): { width: number; height: number };
}
```

Note: `CanvasMeasurer` creates a hidden `<canvas>` element on first call and
caches it. It must not crash in Node/jsdom (wrap canvas creation in try/catch
and fall back to FormulaMeasurer if canvas is unavailable).

## Acceptance criteria

- Given `defaultTheme.colors.background`, when read, then value is `"#FFFFFF"`
- Given `darkTheme.colors.background`, when read, then value differs from
  `defaultTheme.colors.background`
- Given `resolveTheme('dark')`, when called, then returns `darkTheme`
- Given `resolveTheme({ colors: { background: '#000' } })`, when called,
  then result.colors.background === '#000' and other colors come from defaultTheme
- Given `new FormulaMeasurer().measure("Hello", { family: "Arial", size: 14 })`,
  when called, then width > 0 and height > 0
- Given `new FixedMeasurer(8, 16).measure("Hi", { family: "Arial", size: 14 })`,
  when called, then width === 16 (2 chars × 8) and height === 16

## Quality bar

`pnpm typecheck && pnpm lint && pnpm test` all pass. Coverage ≥ 90% on both
source files. Commit: `feat(core): implement theme system and string measurer`
