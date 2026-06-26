# T3 — Add LRU cache to CanvasMeasurer

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML. GPL-3.0. Stack: TypeScript + Vite,
Vitest tests (90/90/90 coverage). Porting discipline: port Java faithfully.

This task follows T1 + T2. Read the current file state before editing.

## Task

Add an 8192-entry LRU cache to `CanvasMeasurer.measure`, matching
`StringBounderTeaVM`'s cache behaviour.

### Java reference

```java
// StringBounderTeaVM.java
private static final int MAX_CACHE_SIZE = 8192;

private static final Map<CacheKey, XDimension2D> cache =
    new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<CacheKey, XDimension2D> eldest) {
            return size() > MAX_CACHE_SIZE;
        }
    };

// CacheKey = (UFontImpl font, String text)
// In calculateDimension: cache.computeIfAbsent(key, k -> calculateDimensionSlow(...))
```

### Changes to make

1. Add a private `measureCache` Map to `CanvasMeasurer` using the same
   LRU eviction pattern (access-ordered `Map` capped at 8192):

   ```typescript
   private readonly measureCache = new Map<string, { width: number; height: number }>();
   private static readonly MAX_CACHE_SIZE = 8192;
   ```

2. Build the cache key in `measure()`: `` `${this.buildFontString(font)}|${text}` ``

3. Before calling `ctx.measureText`, check `measureCache`. On hit, return the
   cached value. On miss, compute, store in cache, then return.

4. Evict the oldest entry when cache size exceeds `MAX_CACHE_SIZE`:
   ```typescript
   if (this.measureCache.size > CanvasMeasurer.MAX_CACHE_SIZE) {
     const oldest = this.measureCache.keys().next().value;
     if (oldest !== undefined) this.measureCache.delete(oldest);
   }
   ```
   Note: JavaScript's `Map` preserves insertion order. Deletion of `next().value`
   removes the least-recently-inserted entry. This is insertion-order LRU, which
   is sufficient for our purposes (matches the spirit of Java's access-order LRU).

5. The fallback path (FormulaMeasurer) is **not** cached — only the canvas path.

## Write-Set

- `src/core/measurer.ts`
- `tests/unit/measurer.test.ts`

## Read-Set

- `src/core/measurer.ts` — read fully; T1+T2 changes already applied

## Architecture Decisions

See `plans/text-measurement/decisions.md#d3-lru-cache`:
- Cache in `CanvasMeasurer` only
- Max 8192 entries matching `StringBounderTeaVM`

## Acceptance Criteria

- Given same font+text called twice with mock ctx, context factory is called once
  (second call is a cache hit)
- Given 8193 distinct texts measured with mock ctx, cache size does not exceed 8192
- Given two different font specs for the same text, each produces its own cache entry
  (both are stored separately)
- Given CanvasMeasurer with mock ctx and populated cache, measure returns correct
  cached width on hit
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all pass

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.
