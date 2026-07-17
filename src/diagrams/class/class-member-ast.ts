/**
 * `Member`/`Visibility` types for class/interface/enum/object leaves.
 *
 * Split out of ast.ts purely to keep that file under the repo's
 * 500-line-per-file cap (mirrors class-json-ast.ts's own "split out of a
 * capped file, behavior unchanged" precedent) — ast.ts re-exports both
 * symbols so callers can still `import type { Member, Visibility } from
 * './ast.js'`.
 */
import type { UrlInfo } from './class-url.js';

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
   * G2 N31: the EXACT raw text between the name (or method's closing `)`)
   * and {@link type} -- upstream stores each member line close to
   * verbatim (`cucadiagram/Member.java`'s raw `CharSequence` constructor,
   * see `class-layout-helpers.ts#formatMemberText`'s own doc comment for
   * why this port reconstructs from name/type instead of doing the same),
   * so a non-canonical spacing (`name : Type`, `name:Type`) must survive
   * the round-trip rather than being silently normalized to `': '`
   * (jar-verified: `sasito-46-padu855`'s `+counter : string` renders with
   * the space before the colon PRESERVED). Absent (falls back to the
   * canonical `': '`) whenever the source used exactly that spacing --
   * zero behavior change for the overwhelmingly common case.
   * @see ~/git/plantuml/.../cucadiagram/Member.java (constructor)
   */
  typeSeparator?: string;
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
   * Object-leaf sizing (class-object-map-sizing.ts) AND class/interface/
   * enum/annotation/abstract leaf sizing (`class-layout-helpers.ts#
   * buildSectionRows`, G2 N4) both use this to decide whether to
   * reserve/draw a visibility icon (`MethodsOrFieldsArea#hasSmallIcon`).
   * G2 N4 note: an EARLIER iteration's doc comment here claimed class
   * leaves deliberately, permanently ignore this field ("a pre-existing
   * pinned divergence") -- that was jar-unverified; the fresh 2026-07-16
   * oracle re-capture shows jar draws NO visibility icon at all for an
   * implicit-visibility class member (`jobuco-44-zife032`'s bare "Bar"
   * field), so `buildSectionRows` now gates on this field for class leaves
   * too, closing the divergence rather than preserving it.
   * @see ~/git/plantuml/.../cucadiagram/MethodsOrFieldsArea.java#hasSmallIcon
   */
  visibilityExplicit?: boolean;
  /**
   * G2 N16: this member's OWN parsed `[[url]]`/`[[[url]]]` link suffix
   * (`class-member-parser.ts#parseMemberLine` strips it from the display
   * text AND parses its bracket content via `class-url.ts#parseUrlBracket`
   * -- N15 only detected PRESENCE via a boolean `hasOwnUrl`; N16 extends
   * that to the full parsed value, since two DIFFERENT member rows on the
   * SAME classifier can carry two DIFFERENT urls, and the render-side
   * per-primitive `<a>`-run splitting (`renderer-url.ts`) needs the actual
   * value to decide which consecutive primitives share one `<a>` run, not
   * just whether a row has "some" url). Member-level url syntax is
   * ALWAYS triple-bracket per upstream (`Member.java`'s `URL` pattern
   * wraps `UrlBuilder`'s own `[[...]]` grammar in one more `[...]` layer);
   * a double-bracket suffix is still STRIPPED from the display text (kept
   * detectable) but parses to `undefined` here -- read ONLY by
   * `renderer.ts`'s classifier-level `<a>`-wrap decision, to avoid emitting
   * an incorrect single whole-box wrap when a member row would really need
   * its OWN url instead of falling back to the classifier's.
   */
  ownUrl?: UrlInfo;
}
