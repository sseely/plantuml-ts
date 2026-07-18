/**
 * Member-row/compartment sizing helpers for the generic class/interface/
 * enum/annotation classifier box (`class-layout-helpers.ts#
 * measureGenericClassifier`).
 *
 * Split out of `class-layout-helpers.ts` purely to keep that file under the
 * project's 500-line cap (G2 N14 — the file was already at the cap before
 * this iteration's icon-zone-reservation fix grew it further; this is a
 * pure move, no behavior change, mirrors the existing `class-geo-
 * builders.ts` split precedent).
 */

import type { Classifier } from './ast.js';
import type { ClassifierGeo } from './layout.js';
import { NAME_MARGIN_TOTAL } from './class-badge.js';
import { javaRound4 } from '../../core/number-format.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';
import type { MemberRowBuild } from './class-member-creole.js';
import { buildWrappedMemberRows, atomsToPlainText } from './class-member-creole.js';

/**
 * `MethodsOrFieldsArea#asBlockMemberImpl`: `TextBlockUtils.withMargin(this,
 * 6, 4)` — 4px top+bottom margin wraps the section's content REGARDLESS of
 * whether it is empty (`BodierLikeClassOrObject#getBody`'s default branch
 * always builds BOTH a fields and a methods `MethodsOrFieldsArea`, even when
 * one/both have zero visible members — jar-verified 3x, `plans/g2-class-svg/
 * ledger.md` N3: a classifier with no declared members still draws 2 empty
 * compartments, 8px tall each, below the header). `EMPTY_SECTION_HEIGHT`
 * is that margin-only floor; a populated section adds `count * rowHeight`
 * content on top of the same 8px margin envelope. `rowHeight` itself
 * (G2 N4, jar-verified with ZERO residual against 5 fixtures spanning 1-2
 * row counts and both compartments -- `jobuco-44-zife032`, `nubisa-82-
 * tuji339`, `bisisi-31-xasa026`, `cojixe-63-vejo525`, `canuti-20-jotu614`)
 * is exactly `fontSize` (a single un-leaded text line, no extra inter-row
 * gap) -- REPLACES the previous `fontSize * 1.4` estimate, which had no
 * upstream basis and consistently over-measured every populated section's
 * height (`plans/g2-class-svg/ledger.md` N4).
 */
const EMPTY_SECTION_HEIGHT = 8;
const SECTION_MARGIN_TOP = 4;

/**
 * A member row's left indent from the classifier box's own left edge -- G2
 * N4/N14. Base case (no row in the WHOLE section has an explicit visibility
 * char): indent 6, jar-verified against `jobuco-44-zife032`/`bisisi-31-
 * xasa026`. Icon case: indent 20 (6 base margin + 14 icon zone), jar-verified
 * against `canuti-20-jotu614`.
 *
 * G2 N14 CORRECTION: this is gated per-SECTION (fields OR methods, the WHOLE
 * `MethodsOrFieldsArea`), NOT per-row -- upstream's `hasSmallIcon()`
 * (MethodsOrFieldsArea.java:125-138) scans every member in the section, and
 * `PlacementStrategyVisibility`'s `col2` (the fixed 14px icon-column x
 * position passed to EVERY row's text block, MethodsOrFieldsArea.java:397-
 * 399 + klimt/geom/PlacementStrategyVisibility.java:62-70) places the text
 * at the SAME x regardless of whether THAT row has its own icon -- a
 * modifier-less row in an icon-bearing section still reserves the column
 * (`getUBlock(null, url)` draws nothing but occupies it). An EARLIER
 * iteration's per-row `showIcon` gate here happened to match `canuti-20-
 * jotu614`/`jobuco-44-zife032`/`bisisi-31-xasa026` only because none of
 * those fixtures has a MIXED section (some rows explicit, some not) -- the
 * same confound `sectionWidth`'s N4-era doc comment (below, since replaced)
 * flagged as unverified for box width and is now confirmed for indent too.
 * `visibilityIcon`/`visibilityIsField` (whether a glyph actually DRAWS)
 * remain gated on the ROW's own `Member.visibilityExplicit`, unchanged --
 * only the shared reserved COLUMN width moved to section scope. Matches
 * `class-object-map-sizing.ts`'s `OBJECT_SMALL_ICON`/`hasIcon` gate for
 * object leaves, which was already section-scoped (this generic-classifier
 * path was the one dispatch branch that never got the same treatment).
 */
export const ROW_TEXT_LEFT_MARGIN = 6;
/** Icon zone reserved (once per section) when any row in it has an explicit
 *  visibility char -- `getCircledCharacterRadius()+3` (17/3+6=11, +3=14, see
 *  `class-object-map-sizing.ts#OBJECT_SMALL_ICON`'s identical derivation). */
const ROW_ICON_ZONE_WIDTH = 14;
const ROW_INDENT_WITH_ICON = ROW_TEXT_LEFT_MARGIN + ROW_ICON_ZONE_WIDTH;

/** One fields-or-methods compartment's total height (margin-only floor when empty). */
export function sectionHeight(count: number, memberRowHeight: number): number {
  return count === 0 ? EMPTY_SECTION_HEIGHT : EMPTY_SECTION_HEIGHT + count * memberRowHeight;
}

/**
 * `Member.params !== undefined` means a method (see `Member`'s own doc
 * comment); upstream's equivalent is `BodierLikeClassOrObject#isMethod`
 * (`purged.contains("(") || purged.contains(")")`) — this port already
 * decides method-vs-field at parse time for the two STRUCTURED shapes, so no
 * text re-scan is needed for those. A raw-fallback member (`rawDisplay` set,
 * G2 N12 — text that didn't fit either structured shape) was never bucketed
 * at parse time, so it re-applies upstream's own substring test here —
 * matching `isMethod`'s exact rule, not this port's narrower structured
 * method regex (jar buckets ANY `(`/`)`-containing raw line as a method,
 * however malformed).
 */
export function isMethodMember(m: Classifier['members'][number]): boolean {
  if (m.rawDisplay !== undefined) return m.rawDisplay.includes('(') || m.rawDisplay.includes(')');
  return m.params !== undefined;
}

/** Values shared by BOTH compartments (fields and methods) of one
 *  classifier's row build -- bundled to stay inside this project's
 *  per-function param-count cap (mirrors `note-layout.ts#TipContext`'s own
 *  identical rationale). `measurer`/`fontSpec` dropped (G2 N22): every
 *  member row's width now comes pre-measured off its own `MemberRowBuild`
 *  (`class-member-creole.ts#buildMemberRow`, built once per member in
 *  `measureGenericClassifier` and reused for BOTH the section max-width
 *  scan and the stored row -- see `sectionWidth`'s own doc comment). */
export interface SectionRowContext {
  memberRowHeight: number;
  baselineOffset: number;
}

/**
 * Build the per-member rows for one compartment (fields OR methods), starting
 * at `sectionTop`. `y` is the text BASELINE (G2 N4 -- jar draws plain,
 * un-centered `<text>` for every row, never `dominant-baseline="middle"`;
 * see `renderer.ts#renderRow`'s own doc comment for the render-side half of
 * this fix), `sectionTop + SECTION_MARGIN_TOP + i * memberRowHeight +
 * baselineOffset` where `baselineOffset` is the SAME ascent-from-line-top
 * value `measureGenericClassifier` derives for the header row.
 */
export function buildSectionRows(
  members: Classifier['members'],
  texts: string[],
  rowBuilds: readonly MemberRowBuild[],
  sectionTop: number,
  sectionHasIcon: boolean,
  ctx: SectionRowContext,
): ClassifierGeo['rows'] {
  const { memberRowHeight, baselineOffset } = ctx;
  const rows: ClassifierGeo['rows'] = [];
  const indent = sectionHasIcon ? ROW_INDENT_WITH_ICON : ROW_TEXT_LEFT_MARGIN;
  for (let i = 0; i < members.length; i++) {
    const text = texts[i]!;
    const member = members[i]!;
    const build = rowBuilds[i]!;
    // G2 N65 item 35: `members[]` may repeat the SAME `Member` reference
    // across consecutive entries (a wrapped member's continuation rows,
    // `buildWrappedSectionRowBuilds`'s own doc comment) -- the visibility
    // icon glyph draws ONCE, on the member's own FIRST row only (zero
    // corpus reach for icon-mode + `MaximumWidth` combined, a documented,
    // unverified-but-reasonable scope choice, not a jar citation). Byte-
    // identical to the pre-item-35 `member.visibilityExplicit === true`
    // gate for every classifier where no member ever repeats (the
    // overwhelming common case).
    const showIcon = member.visibilityExplicit === true && members[i - 1] !== member;
    const y = sectionTop + SECTION_MARGIN_TOP + i * memberRowHeight + baselineOffset;
    rows.push({
      text,
      y,
      indent,
      width: javaRound4(build.width),
      atoms: build.atoms,
      ...(showIcon
        ? { visibilityIcon: member.visibility, visibilityIsField: isMethodMember(member) === false }
        : {}),
      ...(member.ownUrl !== undefined ? { url: member.ownUrl } : {}),
    });
  }
  return rows;
}

/**
 * Widest single row's reserved width (icon column, ONCE per section when any
 * row in it has an explicit visibility char + text), or 0 for an empty
 * section. G2 N14: `MethodsOrFieldsArea#calculateDimensionOnlyMembers`'s
 * `smallIcon` term (`hasSmallIcon()`, MethodsOrFieldsArea.java:125-138,155-
 * 157) scans the WHOLE section, not each row individually -- the icon column
 * (`ROW_ICON_ZONE_WIDTH`) is reserved for EVERY row when ANY row in the
 * section carries an explicit visibility char, never per-row. The previous
 * code added `ICON_WIDTH` (18, unverified) to every row unconditionally --
 * jar-verified WRONG two ways: `ducoka-05-cuce457`'s "Test Two" (zero
 * explicit-visibility rows) measured 93.7 vs jar's real 75.7 (exactly the
 * spurious +18); `canuti-20-jotu614`'s "Aaa" (every row explicit) measured
 * jar's real width ONLY with +14, not +18 (162.4 + 14 + 12 = 188.4, the
 * oracle's exact rect width). Mirrors `class-object-map-sizing.ts`'s already-
 * correct `OBJECT_SMALL_ICON`/`hasIcon` gate for object leaves -- this was
 * the one measureClassifier dispatch branch that never got the same
 * treatment.
 */
export function sectionWidth(
  rowBuilds: readonly MemberRowBuild[],
  hasIcon: boolean,
): number {
  const iconReserve = hasIcon ? ROW_ICON_ZONE_WIDTH : 0;
  let widest = 0;
  for (const b of rowBuilds) {
    const w = b.width + iconReserve;
    if (w > widest) widest = w;
  }
  return rowBuilds.length === 0 ? 0 : widest + NAME_MARGIN_TOTAL * 2; // 6px margin each side
}

/** One compartment's member rows, flattened -- see
 *  {@link buildWrappedSectionRowBuilds}'s own doc comment. */
export interface FlatMemberRows {
  readonly members: Classifier['members'];
  readonly texts: string[];
  readonly builds: MemberRowBuild[];
}

/**
 * G2 N65 item 35: expands EACH member into 1+ wrapped `MemberRowBuild`s
 * (`class-member-creole.ts#buildWrappedMemberRows`, Fission word-wrap when
 * a `MaximumWidth` cascade is in effect) and flattens the result into 3
 * lockstep arrays, computed ONCE (same N22 precedent as the pre-existing
 * per-member build: reused for BOTH `sectionWidth`'s max-width scan and
 * `buildSectionRows`' stored rows). A continuation (wrapped, non-first) row
 * repeats the SAME `Member` object reference so `buildSectionRows`'s own
 * icon-suppression gate (`members[i-1] === members[i]`) can distinguish
 * "this member's own first row" from "a continuation of the row above"
 * without a 4th parallel array. `text` stays the member's ORIGINAL,
 * unwrapped display text for the (overwhelmingly common) single-row case --
 * byte-identical to pre-item-35 behavior; only a GENUINELY wrapped member
 * (2+ rows) rebuilds its `text` field from each sub-line's own atoms
 * (`atomsToPlainText` -- `row.text` is otherwise unconsumed by production
 * rendering whenever `row.atoms` is set, `class-member-creole.ts
 * #atomsToPlainText`'s own doc comment).
 */
export function buildWrappedSectionRowBuilds(
  members: Classifier['members'],
  texts: readonly string[],
  fontSpec: { readonly family: string; readonly size: number; readonly bold?: boolean; readonly italic?: boolean },
  measurer: StringMeasurer,
  maxWidth: number,
  sprites: SpriteRegistry | undefined,
): FlatMemberRows {
  const flatMembers: Classifier['members'] = [];
  const flatTexts: string[] = [];
  const flatBuilds: MemberRowBuild[] = [];
  for (let i = 0; i < members.length; i++) {
    const member = members[i]!;
    const text = texts[i]!;
    const wrapped = buildWrappedMemberRows(text, member, fontSpec, measurer, maxWidth, sprites);
    for (const build of wrapped) {
      flatMembers.push(member);
      flatTexts.push(wrapped.length === 1 ? text : atomsToPlainText(build.atoms));
      flatBuilds.push(build);
    }
  }
  return { members: flatMembers, texts: flatTexts, builds: flatBuilds };
}
