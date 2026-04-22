# T11 — Demo App

## Context

Project: plantuml-js — TypeScript PlantUML renderer producing SVG in browser.
Stack: TypeScript 5, Vite dev server. The library source is in `src/`. The demo
app lives in `demo/` and imports from `plantuml-js` which Vite aliases to
`src/index.ts` — it always runs against live source, never a built dist.

## Task

Create the demo app: a three-panel browser page with a diagram-type nav,
editable source textarea, and live SVG preview. Ship with one canonical
sequence example. Follow `planning/demo-app.md` for the full spec.

## Write-set

| File | Action |
|------|--------|
| `demo/vite.config.ts` | Create |
| `demo/index.html` | Create |
| `demo/app.ts` | Create |
| `demo/style.css` | Create |
| `demo/examples/sequence/canonical.puml` | Create |

## Read-set

- `planning/demo-app.md` — UI layout, app.ts sketch, CSS structure, canonical example content
- `src/index.ts` — `render()`, `renderSync()`, `RenderOptions` types

## demo/vite.config.ts

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  publicDir: resolve(__dirname, 'examples'),
  server: { port: 5173 },
  resolve: {
    alias: {
      'plantuml-js': resolve(__dirname, '../src/index.ts'),
    },
  },
  build: {
    outDir: resolve(__dirname, '../dist-demo'),
    emptyOutDir: true,
  },
});
```

## Layout

Three columns:
- Left (200px fixed): nav buttons, one per diagram type
- Middle (flex 1): `<textarea>` for source, error bar below it
- Right (flex 1): SVG preview, render time below it

Header: title left, theme `<select>` right.

## demo/examples/sequence/canonical.puml

Use exactly the auth-flow sequence example from `planning/demo-app.md`:

```
@startuml
skinparam sequenceMessageAlign center

actor User
participant Browser
participant "API Gateway" as API
participant "Auth Service" as Auth
database "User DB" as DB

User -> Browser: Enter credentials
Browser -> API: POST /auth/login
activate API
API -> Auth: validateCredentials(email, pwd)
activate Auth
Auth -> DB: SELECT * FROM users WHERE email = ?
DB --> Auth: user row
Auth --> API: JWT token
deactivate Auth
API --> Browser: 200 OK { token }
deactivate API
Browser --> User: Redirect to dashboard

note over Auth, DB: credentials never leave\nthe auth service
@enduml
```

## Behaviour requirements

- Nav has one button. Clicking it loads `sequence/canonical.puml` via
  `import.meta.glob('./examples/**/*.puml', { as: 'raw' })` and calls `render()`
- `<textarea>` fires `input` event → debounced 200ms → `render()` → inject SVG
- `Ctrl/Cmd + Enter` → immediate re-render (bypasses debounce)
- Theme `<select>` has four options: default, dark, sketchy, monochrome
- On theme change → immediate re-render with new theme
- On render error → show error text in error bar; do NOT crash
- Render time shown as `"render: Xms"` below the SVG

## Acceptance criteria

- Given `pnpm dev` is running, when the demo loads at localhost:5173, then
  the page renders without console errors and the sequence nav button is visible
- Given the page is loaded, when the sequence nav button is clicked, then
  the SVG preview shows a rendered diagram (not an error)
- Given a diagram is showing, when the source textarea is edited and 200ms
  elapses, then the SVG preview updates
- Given an invalid source is typed, when re-rendered, then the error bar
  becomes visible and contains error text
- Given the theme selector is changed to "dark", when the diagram re-renders,
  then the SVG contains a different background fill than the default render

## Quality bar

`pnpm dev` starts without errors. All five acceptance criteria verified
manually in the browser. Commit: `feat(demo): add demo app with sequence example`
