# Architecture Decisions — Phase 2

## D1: Plugin interface for async ELK layout → Option C (separate interfaces)

Use a `SyncPlugin | AsyncPlugin` union type. ELK plugins implement `AsyncPlugin`
(with `layout(): Promise<Geo>`). Phase 1 sequence plugin stays `SyncPlugin`
(with `layoutSync(): Geo`) — no change required.

```typescript
interface SyncPlugin<AST, Geo> {
  accepts(block: Block): boolean;
  parse(block: Block): AST;
  layoutSync(ast: AST, theme: Theme, measurer: StringMeasurer): Geo;
  render(geo: Geo, theme: Theme): string;
}

interface AsyncPlugin<AST, Geo> {
  accepts(block: Block): boolean;
  parse(block: Block): AST;
  layout(ast: AST, theme: Theme, measurer: StringMeasurer): Promise<Geo>;
  render(geo: Geo, theme: Theme): string;
}

type DiagramPlugin<AST, Geo> = SyncPlugin<AST, Geo> | AsyncPlugin<AST, Geo>;
```

`render()` type-narrows with `'layout' in plugin`. `renderSync()` returns an
error SVG for `AsyncPlugin` types — no dead method on the plugin itself.

**Rationale:** A function that exists only to say it doesn't work is worse than
no function. The union type makes the constraint explicit and compiler-enforced.

---

## D2: renderSync() on async plugins → error SVG

`renderSync()` called with an ELK-backed diagram type returns:

```
<svg>...<text>renderSync() is not supported for [type] diagrams —
use render()</text>...</svg>
```

No throw. Consistent with Phase 1's "never throws" contract.

---

## D3: ELK adapter → single shared src/core/elk-adapter.ts

One generic adapter takes `{ nodes, edges, groups? }` input. Each diagram's
`layout.ts` builds that input and calls the adapter. ELK is initialised once
per adapter call (stateless). Eliminates 4× ELK init overhead and gives a
single testable seam.

---

## D4: Node sizing → pre-measure before ELK

Each diagram's `layout.ts` uses `StringMeasurer` to compute node `width` and
`height` before calling ELK. ELK receives fixed node sizes and only performs
routing. SVG compartment layout (member rows, dividers) is handled by the
renderer after ELK returns positions.

---

## D5: Namespace/package containers → ELK compound nodes

Packages and namespaces are modelled as ELK parent nodes containing child
nodes. ELK sizes the parent to encompass its children automatically. No
bespoke bounding-box post-pass required. Nesting is unbounded in PlantUML;
recursive ELK nesting handles this correctly.
