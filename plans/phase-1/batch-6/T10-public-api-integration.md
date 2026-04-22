# T10 — Public API + Integration Tests

## Context

Project: plantuml-js — TypeScript PlantUML renderer producing SVG in browser.
Stack: TypeScript 5 strict, Vitest + Playwright for tests. All pipeline stages
are complete: preprocessor, block extractor, dispatcher, theme, measurer, SVG
primitives, Creole, sequence parser, layout, renderer, and plugin wiring exist
in `src/`.

## Task

Replace the stub `src/index.ts` with the full public API implementation. Wire
together the preprocessor, block extractor, theme resolver, measurer, and
dispatcher. Write integration tests using Playwright's `page.evaluate()` for
accurate canvas-based text measurement. Add fixture `.puml` files.

## Write-set

| File | Action |
|------|--------|
| `src/index.ts` | Replace stub with full implementation |
| `tests/helpers/render.ts` | Create |
| `tests/helpers/svg-assertions.ts` | Create |
| `tests/integration/sequence.test.ts` | Create |
| `tests/integration/canonical-examples.test.ts` | Create |
| `tests/fixtures/sequence/basic.puml` | Create |
| `tests/fixtures/sequence/notes.puml` | Create |
| `tests/fixtures/sequence/groups.puml` | Create |
| `tests/fixtures/sequence/activation.puml` | Create |
| `tests/fixtures/sequence/autonumber.puml` | Create |
| `tests/fixtures/sequence/dividers.puml` | Create |
| `tests/fixtures/sequence/lost-found.puml` | Create |

## Read-set

- `planning/tdd-plan.md` — section `tests/integration/sequence.test.ts`
- `planning/decisions.md` — D2 (both render() and renderSync()), D4 (measurer), D5 (error SVG)
- `src/core/preprocessor.ts` — `preprocess()` function
- `src/core/block-extractor.ts` — `extractBlocks()`, `UmlSource`
- `src/core/dispatcher.ts` — `registry`, `DiagramRegistry`
- `src/core/theme.ts` — `resolveTheme()`
- `src/core/measurer.ts` — `CanvasMeasurer`, `FormulaMeasurer`
- `src/diagrams/sequence/index.ts` — `sequencePlugin`
- `planning/demo-app.md` — canonical example content (for fixture files)

## Full src/index.ts implementation

```typescript
import { preprocess } from './core/preprocessor.js';
import { extractBlocks } from './core/block-extractor.js';
import { registry } from './core/dispatcher.js';
import { resolveTheme } from './core/theme.js';
import { CanvasMeasurer, FormulaMeasurer } from './core/measurer.js';
import { sequencePlugin } from './diagrams/sequence/index.js';

// Register all Phase 1 plugins
registry.register(sequencePlugin);

export interface RenderOptions {
  theme?: 'default' | 'dark' | 'sketchy' | 'monochrome' | Partial<Theme>;
  measurer?: StringMeasurer;
  maxWidth?: number;
}

function getDefaultMeasurer(): StringMeasurer {
  try {
    return new CanvasMeasurer();
  } catch {
    return new FormulaMeasurer();
  }
}

export function renderSync(source: string, options?: RenderOptions): string {
  try {
    const theme = resolveTheme(options?.theme);
    const measurer = options?.measurer ?? getDefaultMeasurer();
    const preprocessed = preprocess(source);
    // Apply !theme from preprocessor if no explicit theme option
    const resolvedTheme = options?.theme
      ? theme
      : resolveTheme(preprocessed.theme ?? 'default');
    const blocks = extractBlocks(preprocessed.lines);
    if (blocks.length === 0) return errorSvg('No diagram found in source');
    const block = blocks[0]!;
    const plugin = registry.resolve(block);
    const ast = plugin.parse(block);
    const geo = plugin.layoutSync(ast, resolvedTheme, measurer);
    return plugin.render(geo, resolvedTheme);
  } catch (err) {
    return errorSvg(String(err));
  }
}

export async function render(source: string, options?: RenderOptions): Promise<string> {
  return renderSync(source, options);
  // In Phase 2, this will diverge: async ELK layout replaces layoutSync
}

export async function renderAll(source: string, options?: RenderOptions): Promise<string[]> {
  try {
    const theme = resolveTheme(options?.theme);
    const measurer = options?.measurer ?? getDefaultMeasurer();
    const preprocessed = preprocess(source);
    const blocks = extractBlocks(preprocessed.lines);
    return blocks.map(block => {
      try {
        const plugin = registry.resolve(block);
        const ast = plugin.parse(block);
        const geo = plugin.layoutSync(ast, theme, measurer);
        return plugin.render(geo, theme);
      } catch (err) {
        return errorSvg(String(err));
      }
    });
  } catch (err) {
    return [errorSvg(String(err))];
  }
}

function errorSvg(message: string): string {
  const escaped = message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80">` +
    `<rect width="400" height="80" fill="#fee2e2" stroke="#dc2626" stroke-width="1"/>` +
    `<text x="10" y="30" fill="#dc2626" font-family="monospace" font-size="12">PlantUML error:</text>` +
    `<text x="10" y="55" fill="#dc2626" font-family="monospace" font-size="11">${escaped}</text>` +
    `</svg>`;
}
```

## tests/helpers/render.ts

```typescript
import { renderSync } from '../../src/index.js';
import { FixedMeasurer } from '../../src/core/measurer.js';
import { readFile } from 'fs/promises';

// Deterministic measurer for unit/integration tests (no canvas needed)
export const testMeasurer = new FixedMeasurer(8, 16);

export function renderFixture(source: string): string {
  return renderSync(source, { measurer: testMeasurer });
}

export async function renderFile(fixturePath: string): Promise<string> {
  const source = await readFile(fixturePath, 'utf8');
  return renderFixture(source);
}
```

## tests/helpers/svg-assertions.ts

```typescript
import { expect } from 'vitest';

expect.extend({
  toContainElement(svg: string, tag: string) {
    const pass = svg.includes(`<${tag}`);
    return { pass, message: () => `expected SVG to contain <${tag}> element` };
  },
  toContainText(svg: string, text: string) {
    const pass = svg.includes(text);
    return { pass, message: () => `expected SVG to contain text "${text}"` };
  },
  toBeValidSvg(svg: string) {
    const pass = svg.startsWith('<svg') && svg.endsWith('</svg>');
    return { pass, message: () => 'expected string to be a valid SVG' };
  },
});

declare module 'vitest' {
  interface Assertion<R> {
    toContainElement(tag: string): R;
    toContainText(text: string): R;
    toBeValidSvg(): R;
  }
}
```

## Fixture file contents

### tests/fixtures/sequence/basic.puml
```
@startuml
Alice -> Bob: Hello
Bob --> Alice: Hi there
Alice -> Bob: How are you?
Bob --> Alice: I'm fine, thanks
@enduml
```

### tests/fixtures/sequence/notes.puml
```
@startuml
participant Alice
participant Bob
Alice -> Bob: request
note right of Bob: processing
Bob --> Alice: response
note over Alice, Bob: transaction complete
@enduml
```

### tests/fixtures/sequence/groups.puml
```
@startuml
Alice -> Bob: start
loop 3 times
  Bob -> Bob: process
end
alt success
  Bob --> Alice: ok
else failure
  Bob --> Alice: error
end
@enduml
```

### tests/fixtures/sequence/activation.puml
```
@startuml
Alice -> Bob ++: call
Bob -> Carol ++: delegate
Carol --> Bob --: result
Bob --> Alice --: done
@enduml
```

### tests/fixtures/sequence/autonumber.puml
```
@startuml
autonumber
Alice -> Bob: first
Bob --> Alice: second
Alice -> Bob: third
@enduml
```

### tests/fixtures/sequence/dividers.puml
```
@startuml
== Initialization ==
Alice -> Bob: setup
== Processing ==
Bob -> Carol: work
...5 minutes later...
Carol --> Bob: done
== Teardown ==
Bob --> Alice: complete
@enduml
```

### tests/fixtures/sequence/lost-found.puml
```
@startuml
?-> Alice: incoming
Alice -> Bob: forward
Bob ->?: outgoing
@enduml
```

## Playwright integration test (canonical-examples)

```typescript
// tests/integration/canonical-examples.test.ts
import { test, expect } from '@playwright/test';
import { glob } from 'glob';
import { readFile } from 'fs/promises';

const files = await glob('demo/examples/**/*.puml');

for (const file of files) {
  test(`renders canonical example: ${file}`, async ({ page }) => {
    const source = await readFile(file, 'utf8');
    await page.goto('about:blank');
    const svg = await page.evaluate(async (src) => {
      // @ts-ignore — library is loaded via importmap in the test page
      const { render } = await import('/src/index.ts');
      return render(src);
    }, source);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toMatch(/<\/svg>$/);
    expect(svg).not.toContain('PlantUML error');
  });
}
```

## Acceptance criteria

- Given `"@startuml\nAlice -> Bob: Hello\n@enduml"`, when `render()` is
  called, then result is a Promise resolving to a string starting with `<svg`
- Given `"@startuml\nAlice -> Bob: Hello\n@enduml"`, when `renderSync()` is
  called, then result is a string (not a Promise) starting with `<svg`
- Given invalid syntax inside `@startuml…@enduml`, when `render()` is called,
  then it resolves (does not reject) and SVG contains "PlantUML error"
- Given two `@startuml` blocks, when `renderAll()` is called, then result
  array has length 2
- Given every `.puml` in `tests/fixtures/sequence/`, when each is passed to
  `renderFixture()`, then all return strings starting with `<svg` and not
  containing "PlantUML error"

## Quality bar

`pnpm typecheck && pnpm lint && pnpm test` all pass (including integration
tests). Playwright canonical-examples tests pass. Coverage ≥ 90%.
Commit: `feat: wire public API and add integration tests`
