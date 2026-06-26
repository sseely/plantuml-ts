# T7 — Plugin wiring + integration

## Context

With parser (T4), layout (T5), and renderer (T6) in place, wire them into a
`SyncPlugin` matching the registry contract used by the other diagram plugins.
Registration into `src/index.ts` is deliberately deferred to Batch 8 — while the
old `component`/`usecase` plugins are still registered, adding `description` would
create overlapping `accepts()` claims.

## Task

Create `src/diagrams/description/index.ts`:

```ts
export const descriptionPlugin: SyncPlugin<DescriptionDiagramAST, DescriptionGeometry> = {
  type: 'description',
  accepts(lines) { /* full keyword set + [..]/(..) shorthands, first 20 lines */ },
  parse(block) { return parseDescription(block); },
  layoutSync(ast, theme, measurer) { return layoutDescription(ast, theme, measurer); },
  render(geo, theme) { return renderDescription(geo, theme); },
};
```

`accepts` should claim any block carrying a `KEYWORD_TO_SYMBOL` keyword or an
element shorthand (the full descriptive set — superset of `hasDescriptiveSignal`,
since this plugin *does* own `interface`/`package`/`actor` too).

Add `tests/integration/description.test.ts` exercising the full
parse→layout→render path on real fixtures (migrate from
`tests/integration/component.test.ts` + `usecase.test.ts` and the `cocice`
fixture), asserting on emitted SVG structure.

## Read-set

- `src/core/dispatcher.ts` (`SyncPlugin` contract).
- `src/diagrams/component/index.ts`, `src/diagrams/usecase/index.ts` (accepts +
  wiring patterns).
- `src/diagrams/description/{parser,layout,renderer}.ts` (T4/T5/T6).
- `src/core/descriptive-keywords.ts` (T1 — keyword set).
- `tests/integration/component.test.ts`, `tests/integration/usecase.test.ts`.

## Architecture decisions

D1 (`type:'description'`), D5 (naming). Locked.

## Interface contract (consumed by T8)

```ts
export const descriptionPlugin: SyncPlugin<DescriptionDiagramAST, DescriptionGeometry>;
```

## Acceptance criteria

- Given a full deployment diagram (mixed symbols), when run end-to-end via the
  plugin, then valid SVG containing every element.
- Given the `cocice` fixture parsed+rendered via `descriptionPlugin`, then all
  declared element keywords appear (no collapse).
- Given `descriptionPlugin.accepts` on a descriptive block, then `true`; on a
  pure `class Foo` block, then `false`.
- Given an include/extend use-case fixture, when rendered, then dashed connectors
  with stereotype labels.

## Observability

Extra gate at this batch: run `npx tsx scripts/oracle-gap.ts` against the
component+usecase corpus buckets through the new engine; node/edge/cluster counts
must hold vs the pre-merge baseline (capture baseline before changes if not
recorded). Log results to `decision-journal.md`.

## Rollback

Reversible — delete the file; engine remains unregistered, no runtime effect.

## Quality bar

`pnpm typecheck && pnpm lint && pnpm test && pnpm build` green; 90/90/90. One
commit: `feat(T7): wire descriptionPlugin + integration tests`.
