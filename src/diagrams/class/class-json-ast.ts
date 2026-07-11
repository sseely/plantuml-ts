/**
 * JSON leaf value type for `kind: 'json'` classifiers.
 *
 * Split out of ast.ts purely to keep that file under the repo's
 * 500-line-per-file cap (mirrors class-layout-helpers.ts / class-dot-graph.ts's
 * own "split out of a capped file, behavior unchanged" precedent) — ast.ts
 * re-exports {@link JsonNode} so callers can still `import type { JsonNode }
 * from './ast.js'`.
 */

/**
 * Parsed value of a `json Name { ... }` / `json Name value` leaf (upstream
 * `JsonValue` — `net.sourceforge.plantuml.json.JsonValue`). A tagged union
 * rather than a plain JS object/array so:
 *  - key insertion order is preserved exactly regardless of key shape (a
 *    plain JS object silently reorders purely-numeric string keys ahead of
 *    non-numeric ones, which JSON object keys are not guaranteed to avoid);
 *  - the value's kind can be discriminated the same way upstream's
 *    `JsonValue#isString`/`isNumber`/`isTrue`/`isFalse`/`isNull`/`isArray`/
 *    `isObject` does (`TextBlockCucaJSon#getTextBlockValue`,
 *    class-json-sizing.ts's recursive measurement).
 * @see ~/git/plantuml/.../json/JsonValue.java
 */
export type JsonNode =
  | { kind: 'scalar'; value: string | number | boolean | null }
  | { kind: 'array'; items: JsonNode[] }
  | { kind: 'object'; entries: { key: string; value: JsonNode }[] };
