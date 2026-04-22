# T1 — Project Bootstrap

## Context

Project: plantuml-js — a TypeScript-native PlantUML renderer that produces SVG
output in the browser. This is a greenfield repo. No source files exist yet
(only planning docs in `planning/` and the mission brief in `plans/`).

Stack: TypeScript 5+, Vite (library build), Vitest, Playwright, ESLint with
@typescript-eslint, pnpm.

## Task

Create all project configuration files so that subsequent tasks can write
TypeScript source and run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and
`pnpm dev` without errors.

## Write-set

| File | Action |
|------|--------|
| `package.json` | Create |
| `tsconfig.json` | Create |
| `vite.config.ts` | Create |
| `vitest.config.ts` | Create |
| `eslint.config.ts` | Create |
| `playwright.config.ts` | Create |
| `.gitignore` | Modify (add dist/, dist-demo/, node_modules/, coverage/, .claude/) |
| `src/index.ts` | Create (stub only) |

## Read-set

- `planning/toolchain.md` — full toolchain spec with exact config values
- `planning/architecture.md` — public API shape (`render`, `renderSync`, `renderAll`, `RenderOptions`)
- `.gitignore` (existing) — add to, do not replace

## Architecture decisions

- D2: Both `render()` (Promise<string>) and `renderSync()` (string) exported from day one
- D3: SVG output is string-based, no DOM dependency in `src/`

## Package.json requirements

```json
{
  "name": "plantuml-js",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/plantuml-js.cjs",
  "module": "./dist/plantuml-js.js",
  "types": "./dist/plantuml-js.d.ts",
  "exports": {
    ".": {
      "import": "./dist/plantuml-js.js",
      "require": "./dist/plantuml-js.cjs"
    }
  },
  "scripts": {
    "dev":        "vite --config demo/vite.config.ts",
    "build":      "vite build",
    "build:demo": "vite build --config demo/vite.config.ts",
    "typecheck":  "tsc --noEmit",
    "lint":       "eslint src tests demo",
    "test":       "vitest run --coverage",
    "test:watch": "vitest",
    "test:e2e":   "playwright test"
  },
  "dependencies": {
    "elkjs": "^0.9.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "eslint": "^9.0.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.0.0",
    "vite-plugin-dts": "^3.0.0",
    "vitest": "^1.0.0"
  }
}
```

## tsconfig.json requirements

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests", "demo"]
}
```

## src/index.ts stub

The stub must satisfy typecheck. Export the three public functions with correct
signatures but `throw new Error('not implemented')` bodies:

```typescript
export interface RenderOptions {
  theme?: 'default' | 'dark' | 'sketchy' | 'monochrome';
  maxWidth?: number;
}

export async function render(_source: string, _options?: RenderOptions): Promise<string> {
  throw new Error('not implemented');
}

export function renderSync(_source: string, _options?: RenderOptions): string {
  throw new Error('not implemented');
}

export async function renderAll(_source: string, _options?: RenderOptions): Promise<string[]> {
  throw new Error('not implemented');
}
```

## Vitest config requirements

- environment: `jsdom`
- coverage provider: `v8`
- coverage thresholds: lines 90, branches 90, functions 90
- include: `tests/**/*.test.ts`
- exclude: `tests/e2e/**` (Playwright tests run separately)

## Playwright config requirements

- testDir: `tests/e2e`
- use: `{ browserName: 'chromium' }`
- webServer: start `pnpm dev` on port 5173

## Acceptance criteria

- Given the repo is empty of source, when `pnpm install` runs, then
  `node_modules` exists and exits 0
- Given the bootstrap is complete, when `pnpm typecheck` runs, then
  tsc exits 0 with the stub `src/index.ts`
- Given the bootstrap is complete, when `pnpm test` runs, then vitest
  finds 0 test files and exits 0 (not an error — no tests yet)
- Given the bootstrap is complete, when `pnpm lint` runs, then eslint
  exits 0 on the stub files
- Given the bootstrap is complete, when `pnpm build` runs, then
  `dist/plantuml-js.js` and `dist/plantuml-js.cjs` are created

## Quality bar

All five acceptance criteria must pass. Commit message:
`chore(bootstrap): initialize project scaffolding`
