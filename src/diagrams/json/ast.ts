/**
 * AST types for PlantUML JSON diagrams (@startjson / @endjson).
 */

export interface HighlightDirective {
  readonly path: readonly string[];
  /** Style class name, e.g. 'h1', 'h2'. Empty string means no named class. */
  readonly styleClass: string;
}

export interface JsonDiagramAST {
  /** Parsed JSON value. Check parseError to distinguish null-as-value from parse failure. */
  root: unknown;
  /** True when JSON.parse failed (invalid JSON body). When false, root may still be null. */
  parseError: boolean;
  /** Highlight directives from #highlight lines, each carrying a path and optional style class. */
  highlights: ReadonlyArray<HighlightDirective>;
  /** Optional title from the `title …` directive. */
  title?: string;
}
