# Architecture Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | AST representation | Native JS value (`JSON.parse` result, typed `unknown`) | Zero ceremony; `typeof`/`Array.isArray` sufficient; no wrapping buys nothing |
| 2 | `#highlight` support | Include from the start | Parser concern; corpus fixtures depend on it; `#highlight "key" / "nested"` syntax |
| 3 | Value-type colors | Theme-driven — `theme.colors.graph.json.*` | Consistent with activity pattern; user-overridable |
| 4 | Node positioning | Dot engine, `rankDir: 'LR'` | Faithful to upstream (SmetanaForJson uses graphviz); reuses existing infrastructure |
| 5 | Arrow style | Bézier curves via existing dot spline routing | Free — dot engine already produces Bézier control points; state/usecase renderers show the pattern |

## Theme keys to add (`theme.colors.graph.json`)

```typescript
json?: {
  keyText?: string;           // key column text  — default '#181818'
  stringValue?: string;       // string value text — default '#3A6E96'
  numberValue?: string;       // number value text — default '#A67F52'
  booleanValue?: string;      // boolean value text — default '#BE5D47'
  nullValue?: string;         // null value text   — default '#767676'
  background?: string;        // node fill         — default '#FFFFFF'
  border?: string;            // node stroke       — default '#181818'
  headerBackground?: string;  // key-column bg     — default '#F1F1F1'
  highlightBackground?: string; // highlight row bg — default '#FFFF44'
  arrowColor?: string;        // connector stroke  — default '#181818'
}
```

## Value display rules (from TextBlockJson.getShortString)

| Type | Display |
|------|---------|
| string | the string value (no quotes) |
| number | `toString()` |
| boolean true | `☑ true` (`☑ true`) |
| boolean false | `☐ false` (`☐ false`) |
| null | `␀` (`␀`) |
| object / array | *(empty — rendered as child node)* |

## #highlight syntax

```
#highlight "key"
#highlight "key" / "nested" <<stereotype>>
```

Path segments split on `/`. Optional `<<stereotype>>` maps to a named
highlight style (for now: treat as a no-op style tag, use the default
`highlightBackground` color regardless of stereotype).
