/**
 * `Member`/`Visibility` types for class/interface/enum/object leaves.
 *
 * Split out of ast.ts purely to keep that file under the repo's
 * 500-line-per-file cap (mirrors class-json-ast.ts's own "split out of a
 * capped file, behavior unchanged" precedent) — ast.ts re-exports both
 * symbols so callers can still `import type { Member, Visibility } from
 * './ast.js'`.
 */

/**
 * `'*'` is `VisibilityModifier.IE_MANDATORY` — a fifth visibility char (in
 * addition to the four UML ones) upstream recognizes on ANY member line,
 * object leaves included (donoki-79-riku189's `* Bullet item` rows).
 * @see ~/git/plantuml/.../skin/VisibilityModifier.java
 */
export type Visibility = '+' | '-' | '#' | '~' | '*';

export interface Member {
  visibility: Visibility;
  name: string;
  /** Return type (methods) or field type (attributes). */
  type?: string;
  /**
   * Defined means this is a method; undefined means this is an attribute.
   * An empty array means a method with no parameters.
   */
  params?: string[];
  isStatic: boolean;
  isAbstract: boolean;
  /** Set to true by hide/show post-processing when this member should not be rendered. */
  hidden?: boolean;
  /**
   * Raw, unstructured display text for an OBJECT-leaf member line that
   * doesn't fit the `name = value` / bare `name` shapes this AST otherwise
   * structures into `name`/`type`. Upstream's `BodierLikeClassOrObject
   * #addFieldOrMethod` never rejects a body line — every raw line becomes a
   * `Member` display row, verbatim (after visibility-char stripping, see
   * {@link visibilityExplicit}) — so an object leaf's sizing/rendering must
   * fall back to showing this text as-is rather than dropping the line.
   * Absent for the two structured shapes (`name = value`, bare `name`) and
   * for every non-object classifier kind.
   * @see ~/git/plantuml/.../cucadiagram/Member.java (constructor)
   * @see ~/git/plantuml/.../cucadiagram/BodierLikeClassOrObject.java#addFieldOrMethod
   */
  rawDisplay?: string;
  /**
   * True when this member's raw source line carried an explicit leading
   * visibility character (`VisibilityModifier.isVisibilityCharacter`) that
   * was detected and stripped into {@link visibility} — as opposed to
   * `visibility`'s default `'+'` assigned when no character was present.
   * Object-leaf sizing (class-object-map-sizing.ts) uses this to decide
   * whether to reserve/draw a visibility icon
   * (`MethodsOrFieldsArea#hasSmallIcon`); absent (falsy) for every
   * class-leaf member — class rows always show an icon regardless of
   * explicit/implicit visibility, a pre-existing pinned divergence this
   * field does not change.
   * @see ~/git/plantuml/.../cucadiagram/MethodsOrFieldsArea.java#hasSmallIcon
   */
  visibilityExplicit?: boolean;
}
