# Toolchain Decisions

## Build System — Vite

**Choice:** Vite with `vite-plugin-dts` for TypeScript declaration files.

**Rationale:**
- Library mode (`build.lib`) produces ESM + CJS bundles cleanly.
- Fast HMR during development, especially useful for visual iteration.
- Native ESM output aligns with how Mermaid ships.
- Tree-shaking means unused diagram plugins don't bloat the bundle.

**Alternatives considered:**
- esbuild directly — faster but less ergonomic for library builds.
- Rollup — good but Vite wraps it and adds dev server ergonomics.
- tsc alone — no bundling, awkward for browser distribution.

## Package Manager — pnpm

Faster installs, stricter dependency isolation than npm.

## Testing — Vitest

**Choice:** Vitest.

**Rationale:**
- Same config as Vite; zero friction.
- Fast parallel execution.
- jsdom environment for DOM-dependent tests (canvas measurement fallback).
- Snapshot support for SVG regression tests.

**Test structure:**
```
tests/
  fixtures/            — .puml files mirroring plantuml.com examples
    sequence/
    class/
    …
  helpers/
    render.ts          — shared render() wrapper
    svg-assertions.ts  — custom expect matchers for SVG structure
  unit/
    preprocessor.test.ts
    block-extractor.test.ts
    creole.test.ts
    …
  integration/         — fixture-driven: parse each .puml, compare SVG
    sequence.test.ts
    class.test.ts
    …
  visual/              — pixelmatch snapshot tests (optional, CI-gated)
```

## TypeScript Config

```jsonc
// tsconfig.json
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
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are enabled to
catch index-out-of-bounds and optional field bugs at compile time.

## Linting

**ESLint** with `@typescript-eslint/recommended-type-checked`. Key rules:
- `no-explicit-any` — error
- `prefer-const` — error
- `no-unused-vars` — error
- `consistent-type-imports` — enforced

No Prettier (format-on-save via editor; avoids lint/format conflicts in CI).

## Dependencies

### Runtime (bundled)
| Package | Purpose | Why not X |
|---------|---------|-----------|
| `elkjs` | Graph layout | Graphviz can't run in browser; ELK.js is pure JS and PlantUML already supports ELK |

### Runtime (peer, optional)
None. The library is self-contained. Canvas is a browser built-in.

### Dev only
| Package | Purpose |
|---------|---------|
| `vite` | Build + dev server |
| `vitest` | Test runner |
| `jsdom` | DOM in tests |
| `@vitest/coverage-v8` | Coverage |
| `typescript` | Compiler |
| `eslint` + `@typescript-eslint` | Linting |
| `pixelmatch` | Visual regression (optional phase) |
| `pngjs` | PNG decode for pixelmatch |

## Bundle Output

```
dist/
  plantuml-js.js       — ESM bundle (primary)
  plantuml-js.cjs      — CJS bundle (Node.js compat)
  plantuml-js.d.ts     — Types
  plantuml-js.umd.js   — UMD for CDN / script tag use (optional)
```

ELK.js is bundled in (not a peer dep) to keep the "drop in a `<script>` tag"
experience simple.

## CDN / Markdown Integration

For Markdown preview tools that mirror the Mermaid integration pattern:

```html
<script type="module">
  import { renderAll } from 'https://cdn.example.com/plantuml-js/1.0.0/plantuml-js.js';

  // Find all code blocks with language "plantuml"
  for (const pre of document.querySelectorAll('pre code.language-plantuml')) {
    const svg = await renderAll(pre.textContent);
    const container = document.createElement('div');
    container.innerHTML = svg[0];
    pre.parentElement.replaceWith(container);
  }
</script>
```

## CI Pipeline (GitHub Actions)

```yaml
jobs:
  build:
    steps:
      - pnpm install
      - pnpm typecheck      # tsc --noEmit
      - pnpm lint           # eslint
      - pnpm test           # vitest run --coverage
      - pnpm build          # vite build
  coverage:
    # Fail if line/branch/function < 90%
```

## Version Strategy

Semantic versioning. Major version bumps only for breaking public API changes.
PlantUML syntax additions are minor versions.

## Repo Conventions

- `src/` — source, no generated files
- `dist/` — gitignored, CI artifact
- `tests/fixtures/` — committed .puml files; updated as new features land
- `planning/` — this folder; updated as decisions are made
