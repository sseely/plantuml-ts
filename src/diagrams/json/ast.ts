/**
 * AST types for PlantUML JSON diagrams (@startjson / @endjson).
 */

export interface JsonDiagramAST {
  /** Parsed JSON value. Check parseError to distinguish null-as-value from parse failure. */
  root: unknown;
  /** True when JSON.parse failed (invalid JSON body). When false, root may still be null. */
  parseError: boolean;
  /** Highlight paths from #highlight directives. Each is an array of
   *  key segments (split on " / "). */
  highlights: ReadonlyArray<readonly string[]>;
  /** Optional title from the `title …` directive. */
  title?: string;
}
