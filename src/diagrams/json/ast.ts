/**
 * AST types for PlantUML JSON diagrams (@startjson / @endjson).
 */

export interface JsonDiagramAST {
  /** Parsed JSON value. null means the body was invalid JSON. */
  root: unknown;
  /** Highlight paths from #highlight directives. Each is an array of
   *  key segments (split on " / "). */
  highlights: ReadonlyArray<readonly string[]>;
}
