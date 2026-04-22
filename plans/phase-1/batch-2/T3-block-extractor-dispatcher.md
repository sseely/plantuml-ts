# T3 — Block Extractor + Dispatcher

## Context

Project: plantuml-js — TypeScript PlantUML renderer producing SVG in browser.
Stack: TypeScript 5 strict, Vitest for tests.

The block extractor splits preprocessed source lines into one or more `UmlSource`
blocks (each bounded by `@start…` / `@end…` markers). The dispatcher holds a
registry of `DiagramPlugin` instances and resolves which plugin handles a given
`UmlSource` by calling each plugin's `accepts()` method in priority order.

## Task

Implement `src/core/block-extractor.ts`, `src/core/dispatcher.ts`, and their
tests using TDD. Write each test first, then implement. Follow the test
descriptions in `planning/tdd-plan.md` under `tests/unit/block-extractor.test.ts`.

## Write-set

| File | Action |
|------|--------|
| `src/core/block-extractor.ts` | Create |
| `src/core/dispatcher.ts` | Create |
| `tests/unit/block-extractor.test.ts` | Create |

## Read-set

- `planning/tdd-plan.md` — section `tests/unit/block-extractor.test.ts`
- `planning/architecture.md` — sections "Block extractor" and "Dispatcher"
- `planning/decisions.md` — D1 (plugin accepts() probe)

## Interface contracts

```typescript
// src/core/block-extractor.ts

export type DiagramType =
  | 'sequence' | 'class' | 'component' | 'state' | 'usecase'
  | 'activity' | 'object' | 'timing' | 'mindmap' | 'gantt' | 'wbs'
  | 'unknown';

export interface UmlSource {
  readonly lines: readonly string[];
  readonly type: DiagramType;
}

export function extractBlocks(processedLines: readonly string[]): UmlSource[];
```

```typescript
// src/core/dispatcher.ts

import type { DiagramType, UmlSource } from './block-extractor.js';

export interface DiagramPlugin<AST = unknown, Geo = unknown> {
  readonly type: DiagramType;
  accepts(lines: readonly string[]): boolean;
  parse(source: UmlSource): AST;
  layout(ast: AST, theme: Theme, measurer: StringMeasurer): Promise<Geo>;
  layoutSync(ast: AST, theme: Theme, measurer: StringMeasurer): Geo;
  render(geo: Geo, theme: Theme): string;
}

export class DiagramRegistry {
  register(plugin: DiagramPlugin): void;
  resolve(source: UmlSource): DiagramPlugin;
}

export const registry: DiagramRegistry;
```

## Block extraction rules

- `@startuml` / `@enduml` — most diagram types
- `@startmindmap` / `@endmindmap`, `@startgantt` / `@endgantt`,
  `@startwbs` / `@endwbs` — type inferred from the `@start<type>` suffix
- Lines before first `@start` or after last `@end` are ignored
- Multiple blocks in one source string → array of length > 1
- Leading/trailing blank lines inside a block are trimmed from `lines`

## Type detection

For `@startuml` (no type suffix), after extracting lines, call
`registry.resolve(source)` which probes each plugin's `accepts()` method.
The sequence plugin's `accepts()` returns true when any of these patterns
appear in the first 20 non-empty lines:
- A line containing `->`, `->>`, `-->`, or `-->>`
- A line starting with `participant`, `actor`, `boundary`, `control`,
  `entity`, `database`, `collections`, or `queue`

If no plugin accepts, block.type remains `'unknown'`.

## Acceptance criteria

- Given `@startuml\nAlice -> Bob\n@enduml`, when extracted, then one
  UmlSource returned with lines `["Alice -> Bob"]` and type `'sequence'`
- Given source with no `@startuml`, when extracted, then `[]` returned
- Given two `@startuml…@enduml` blocks, when extracted, then array of length 2
- Given `@startmindmap\n* Root\n@endmindmap`, when extracted, then
  `block.type === 'mindmap'`
- Given `registry.resolve()` called with unknown type UmlSource, when
  no plugin accepts, then an error-sentinel plugin is returned that renders
  an error SVG (does not throw)

## Quality bar

`pnpm typecheck && pnpm lint && pnpm test` all pass. Coverage ≥ 90% on both
source files. Commit: `feat(core): implement block extractor and dispatcher`
