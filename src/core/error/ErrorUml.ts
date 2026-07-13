/**
 * One error, as the error diagram prints it: the message, the line it was
 * raised on, a score (used to pick the "best" error when several diagram
 * parsers each fail on the same source), and — when the parser had already
 * committed to a diagram type — that type, which `getError()` appends to the
 * message as `(Assumed diagram type: sequence)`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/ErrorUml.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/ErrorUmlType.java
 */

import type { LineLocation } from '../tim/LineLocation.js';
import type { StringLocated } from '../tim/StringLocated.js';

/**
 * Upstream is a two-member Java enum; a string-literal union is this port's
 * translation of it (see CLAUDE.md's translation table).
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/ErrorUmlType.java
 */
export type ErrorUmlType = 'SYNTAX_ERROR' | 'EXECUTION_ERROR';

/**
 * The human-readable diagram-type name upstream's `DiagramType#humanReadableName`
 * produces, for the `(Assumed diagram type: X)` suffix. This port's
 * `DiagramType` (`block-extractor.ts`) is already lowercase, so callers pass it
 * through directly.
 * @see ~/git/plantuml/.../core/DiagramType.java#humanReadableName
 */
export type AssumedDiagramType = string;

/** @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/ErrorUml.java */
export class ErrorUml {
  private readonly error: string;
  private readonly errorType: ErrorUmlType;
  private readonly line: StringLocated | undefined;
  private readonly scoreValue: number;
  private readonly diagramType: AssumedDiagramType | undefined;

  constructor(
    type: ErrorUmlType,
    error: string,
    scoreValue = 0,
    line?: StringLocated,
    diagramType?: AssumedDiagramType,
  ) {
    this.scoreValue = scoreValue;
    this.error = error;
    this.errorType = type;
    this.line = line;
    this.diagramType = diagramType;
  }

  score(): number {
    return this.scoreValue;
  }

  toString(): string {
    return `${this.errorType} ${String(this.getPosition())} ${this.error}`;
  }

  /** @see ~/git/plantuml/.../ErrorUml.java#getError */
  getError(): string {
    if (this.diagramType !== undefined)
      return `${this.error} (Assumed diagram type: ${this.diagramType})`;

    return this.error;
  }

  /** @see ~/git/plantuml/.../ErrorUml.java#getPosition */
  getPosition(): number {
    if (this.line === undefined) return 0;

    return this.line.getLocation()?.getPosition() ?? 0;
  }

  getLineLocation(): LineLocation | undefined {
    return this.line?.getLocation();
  }

  getLine(): StringLocated | undefined {
    return this.line;
  }

  getErrorType(): ErrorUmlType {
    return this.errorType;
  }
}
