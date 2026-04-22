# T5 — Creole Parser

## Context

Project: plantuml-js — TypeScript PlantUML renderer producing SVG in browser.
Stack: TypeScript 5 strict, Vitest for tests.

PlantUML labels support a subset of Creole wiki markup for rich text. The
creole parser transforms a marked-up string into a sequence of SVG `<tspan>`
elements that can be embedded inside a `<text>` element.

## Task

Implement `src/core/creole.ts` and its tests using TDD. Write each test first,
then implement. Follow test descriptions in `planning/tdd-plan.md` under
`tests/unit/creole.test.ts`.

## Write-set

| File | Action |
|------|--------|
| `src/core/creole.ts` | Create |
| `tests/unit/creole.test.ts` | Create |

## Read-set

- `planning/tdd-plan.md` — section `tests/unit/creole.test.ts`

## Interface contract

```typescript
export interface CreoleSpan {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color?: string;
}

// Parse a Creole-marked string into spans
export function parseCreole(input: string): CreoleSpan[];

// Convert spans to SVG tspan elements (as a string)
// dy is the line offset applied to the first tspan
export function spansToTspan(spans: CreoleSpan[], style?: { fill?: string }): string;

// Convenience: full pipeline
export function creoleToSvg(input: string, style?: { fill?: string }): string;
```

## Markup to support

| Markup | Effect |
|--------|--------|
| `**text**` | Bold |
| `//text//` | Italic |
| `__text__` | Underline |
| `--text--` | Strikethrough |
| `<color:red>text</color>` | Text color (any CSS color or hex) |
| `<b>text</b>` | Bold (HTML alias) |
| `<i>text</i>` | Italic (HTML alias) |
| `<u>text</u>` | Underline (HTML alias) |
| `<s>text</s>` | Strikethrough (HTML alias) |

Markup may be nested. Unclosed markup is rendered as literal text.

## tspan output format

```xml
<!-- Bold span -->
<tspan font-weight="bold">bold text</tspan>

<!-- Italic span -->
<tspan font-style="italic">italic text</tspan>

<!-- Underline span -->
<tspan text-decoration="underline">underlined</tspan>

<!-- Strikethrough span -->
<tspan text-decoration="line-through">struck</tspan>

<!-- Color span -->
<tspan fill="red">colored</tspan>

<!-- Plain text -->
<tspan>plain</tspan>
```

Multiple styles on the same span combine: `<tspan font-weight="bold" font-style="italic">`.

## Acceptance criteria

- Given `"hello world"`, when parsed, then `creoleToSvg()` returns a single
  `<tspan>hello world</tspan>`
- Given `"**bold**"`, when parsed, then output contains
  `font-weight="bold"` tspan wrapping `bold`
- Given `"//italic//"`, when parsed, then output contains
  `font-style="italic"` tspan
- Given `"--strike--"`, when parsed, then output contains
  `text-decoration="line-through"` tspan
- Given `"__under__"`, when parsed, then output contains
  `text-decoration="underline"` tspan
- Given `"**bold** and //italic//"`, when parsed, then output has three
  tspan elements (bold, plain " and ", italic)
- Given `"<color:red>colored</color>"`, when parsed, then output contains
  `fill="red"` tspan

## Quality bar

`pnpm typecheck && pnpm lint && pnpm test` all pass. Coverage ≥ 90% on
`src/core/creole.ts`. Commit: `feat(core): implement Creole markup parser`
