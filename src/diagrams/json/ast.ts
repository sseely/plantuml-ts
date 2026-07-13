/**
 * AST types for PlantUML JSON diagrams (@startjson / @endjson).
 */

import type { DiagramAnnotations } from '../../core/annotations/index.js';

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
  /**
   * caption/legend/header/footer/mainframe chrome (mission G0b/T6). For the
   * json/yaml engines `title` above stays authoritative (NOT mirrored into
   * `annotations.title`) until T8 migrates it to shared chrome — the hcl
   * engine (which shares this AST type but never captured `title` at all
   * pre-T6) is the one exception: hcl routes title through here too, since
   * there is no bespoke field of its to conflict with.
   * Always populated by `parseJson`/`parseYaml`/`parseHcl` (default
   * `createAnnotations()`).
   */
  annotations?: DiagramAnnotations;
}
