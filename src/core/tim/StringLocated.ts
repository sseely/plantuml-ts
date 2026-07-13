/**
 * Minimal port of the surface this batch's write-set (`tim/` memory,
 * function, and `Eater` primitives) actually calls on
 * `net.sourceforge.plantuml.text.StringLocated` and
 * `net.sourceforge.plantuml.utils.LineLocation`.
 *
 * Scope guard: `net.sourceforge.plantuml.text` is NOT ported here.
 * `StringLocated.java` is a 279-line class carrying "Jaws" backslash/
 * newline escaping, triple-quote-separator splitting, trim caching, and
 * inner-comment stripping -- none of which any file in this write-set
 * calls. Only the constructor plus `getString` / `getLocation` / `length`
 * / `charAt` / `getType` are used; those are the only members declared
 * below.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/text/StringLocated.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/utils/LineLocation.java
 */

/**
 * Opaque line-position handle. No file in this batch's write-set calls a
 * method on it directly -- every use here only stores or forwards the
 * reference (via `StringLocated#getLocation`) toward a future batch
 * (`TContext` / the iterator chain) that will supply the real
 * `LineLocation` (position / description / parent, per upstream).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/utils/LineLocation.java
 */
export type LineLocation = unknown;

/**
 * Value space only -- NOT the classifier. Upstream's `TLineType` is an enum
 * that also carries ~250 lines of regex-based line classification
 * (`getFromLineInternal`); no file in this batch's write-set calls that
 * classifier. The only use of `TLineType` in scope is
 * `TFunctionImpl#addBody` comparing an already-known `StringLocated#getType()`
 * against `TLineType.RETURN` to detect a synthesized `!return` body line.
 * This is the full upstream member-name list (a name-space-only
 * declaration, zero classification logic) so that a future batch porting
 * the real classifier can slot in without widening this union.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/text/TLineType.java
 */
export type TLineType =
  | 'PLAIN'
  | 'AFFECTATION_DEFINE'
  | 'AFFECTATION'
  | 'ASSERT'
  | 'IF'
  | 'IFDEF'
  | 'UNDEF'
  | 'IFNDEF'
  | 'ELSE'
  | 'ELSEIF'
  | 'ENDIF'
  | 'WHILE'
  | 'ENDWHILE'
  | 'FOREACH'
  | 'ENDFOREACH'
  | 'DECLARE_RETURN_FUNCTION'
  | 'DECLARE_PROCEDURE'
  | 'END_FUNCTION'
  | 'RETURN'
  | 'LEGACY_DEFINE'
  | 'LEGACY_DEFINELONG'
  | 'THEME'
  | 'INCLUDE'
  | 'INCLUDE_DEF'
  | 'IMPORT'
  | 'STARTSUB'
  | 'ENDSUB'
  | 'INCLUDESUB'
  | 'LOG'
  | 'DUMP_MEMORY'
  | 'COMMENT_SIMPLE'
  | 'COMMENT_LONG_START'
  | 'OPTION';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/text/StringLocated.java
 */
export class StringLocated {
  private readonly s: string;
  private readonly location: LineLocation;
  private readonly type: TLineType | undefined;

  /**
   * Upstream lazily computes `type` via `TLineType.getFromLineInternal` on
   * first `getType()` call. That classifier is out of this batch's scope
   * (see file header), so this port instead accepts the classification
   * explicitly at construction. Every construction site inside this
   * batch's write-set either never calls `getType()` on the result, or
   * constructs a line whose classification is already known by
   * construction (`Eater#eatDeclareReturnFunctionWithOptionalReturn`'s
   * synthesized `"!return " + ...` body line) -- so no in-scope call site
   * needs the real regex classifier. A future batch supplying the real
   * classifier computes `type` before constructing; this class does not
   * change.
   */
  constructor(s: string, location: LineLocation, type?: TLineType) {
    this.s = s;
    this.location = location;
    this.type = type;
  }

  getString(): string {
    return this.s;
  }

  getLocation(): LineLocation {
    return this.location;
  }

  length(): number {
    return this.s.length;
  }

  charAt(i: number): string {
    return this.s.charAt(i);
  }

  /**
   * Unclassified (no `type` supplied at construction) defaults to
   * `'PLAIN'` -- a non-`RETURN` sentinel, matching `TFunctionImpl#addBody`'s
   * expectation that only an explicitly RETURN-classified line trips the
   * `!return` branch.
   * @see ~/git/plantuml/.../text/StringLocated.java#getType
   */
  getType(): TLineType {
    return this.type ?? 'PLAIN';
  }
}
