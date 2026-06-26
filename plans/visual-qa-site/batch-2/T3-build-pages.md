# T3 — Page Generator Script

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: TypeScript, Node.js
ESM, vitest, vite. Scripts run via `jiti` (already a devDependency).

The library's public API (from `src/index.ts`):
```typescript
export async function render(source: string, options?: RenderOptions): Promise<string>
export function renderSync(source: string, options?: RenderOptions): string
```

In browser pages, import from `../../dist/plantuml-js.js` (ESM build,
relative to `tests/visual/`).

## Task

Write `scripts/build-pages.ts` — a Node.js script that reads all
`tests/visual/data/<type>.json` manifests and generates:

1. `tests/visual/index.html` — landing page listing all types with
   fixture counts and links to per-type pages.

2. `tests/visual/<type>.html` — one page per type, one row per fixture.

### Row layout (per fixture)

```html
<div class="row" data-slug="<slug>">
  <h3 class="slug"><slug></h3>
  <details class="markup">
    <summary>PlantUML markup</summary>
    <pre><code><escaped markup></code></pre>
  </details>
  <div class="panels">
    <div class="panel original">
      <h4>Original (plantuml.com)</h4>
      <img src="./reference/<type>/<slug>.png" alt="<slug>" loading="lazy">
    </div>
    <div class="panel ours">
      <h4>Ours</h4>
      <div class="svg-container" data-markup="<escaped markup>"></div>
    </div>
  </div>
</div>
```

The `data-markup` attribute holds the raw markup (HTML-escaped). The
inline script renders SVGs on DOMContentLoaded.

### In-browser rendering script (inline `<script type="module">`)

```javascript
import { render } from '../../dist/plantuml-js.js';

document.addEventListener('DOMContentLoaded', async () => {
  const containers = document.querySelectorAll('.svg-container[data-markup]');
  for (const el of containers) {
    const markup = el.getAttribute('data-markup');
    try {
      el.innerHTML = await render(markup);
    } catch (err) {
      el.textContent = String(err);
    }
  }
});
```

### Unimplemented type placeholder

If a type is not in the currently implemented set
(sequence, class, component, state, usecase, activity, object),
the Ours panel shows:

```html
<div class="not-implemented">Not yet implemented</div>
```

Do NOT call `render()` for unimplemented types — it will error or
return garbage. The implemented set is hardcoded in the generator
based on `src/index.ts` plugin registrations (read the file).

### index.html

Lists all types found in `tests/visual/data/`, sorted alphabetically,
with fixture count and a link to the per-type page. Mark implemented
types visually (e.g., ✅ prefix).

## Write-set

- `scripts/build-pages.ts` (create)
- `tests/visual/index.html` — generated at runtime
- `tests/visual/<type>.html` — generated at runtime

## Read-set

- `src/index.ts` — to get the list of currently registered (implemented) types
- `plans/visual-qa-site/decisions.md#D3, D5` — rendering approach, manifest format

## Interface contracts

Manifest consumed (from T1 at runtime):
```typescript
interface FixtureEntry { slug: string; markup: string; }
// tests/visual/data/<type>.json = FixtureEntry[]
```

PNG referenced at: `./reference/<type>/<slug>.png`
Library imported from: `../../dist/plantuml-js.js`

## Acceptance criteria

- Given `data/sequence.json` with 100 entries, `sequence.html` has 100 rows
- Each row has `data-slug` matching the entry's slug
- Each row has a collapsible `<details>` block with the raw markup
- Each row has an `<img>` pointing to `./reference/sequence/<slug>.png`
- Each row has a `.svg-container[data-markup]` div for live rendering
- For an unimplemented type, the Ours panel shows "Not yet implemented"
  instead of a `.svg-container`
- `index.html` lists all types found in `data/`, with fixture counts
- `index.html` links to `<type>.html` for each type
- Implemented types are visually distinguished (✅ prefix or CSS class)
- The inline `<script type="module">` calls `render()` for each
  `.svg-container` on DOMContentLoaded

## Quality bar

```sh
npm run typecheck   # no errors
npm run lint        # no lint errors
```
