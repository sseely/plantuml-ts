/**
 * JSON leaf value type for `kind: 'json'` states — mission A4 Phase L
 * iteration 20 (maruju-55-soko478, embedded `json foo1 { ... }` leaves in a
 * state diagram).
 *
 * `CommandCreateJson`/`CommandCreateJsonSingleLine` are registered VERBATIM
 * by `StateDiagramFactory` from the `objectdiagram.command` package (the
 * SAME shared classes the class engine's `ClassDiagramFactory` registers,
 * not a state-specific reimplementation) — mirrors this project's
 * `CommandRemoveRestore` precedent (`.agent-notes/A4-phase-L-iter13-
 * transition-grammar-singles.md`). This type is a byte-for-byte duplicate of
 * the class engine's own `class-json-ast.ts` (mirror, not cross-engine
 * import — this project's D1 precedent for two engines sharing an upstream
 * grammar).
 *
 * @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java:115-116
 * @see ~/git/plantuml/.../json/JsonValue.java
 * @see src/diagrams/class/class-json-ast.ts (the class engine's own copy)
 */
export type JsonNode =
  | { kind: 'scalar'; value: string | number | boolean | null }
  | { kind: 'array'; items: JsonNode[] }
  | { kind: 'object'; entries: { key: string; value: JsonNode }[] };
