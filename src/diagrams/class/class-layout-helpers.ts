/**
 * Classifier sizing/measurement helpers for the class diagram layout engine
 * (src/diagrams/class/layout.ts).
 *
 * Split out of layout.ts purely to keep every function under the project's
 * per-function complexity/size caps (CCN <= 10, <= 30 NLOC) and the file
 * under the 500-line cap. No behavior differs from the original inline code
 * — this is a pure move.
 *
 * `kind:'object'`, `kind:'map'`, and `kind:'json'` leaves are measured by a
 * dedicated upstream-faithful formula (EntityImageObject / EntityImageMap /
 * EntityImageJson) in ./class-object-map-sizing.ts and ./class-json-sizing.ts,
 * dispatched from measureClassifier below — they no longer share the generic
 * name+members box formula in this file.
 */

import type { Classifier, ClassDiagramAST, Relationship } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { DotInputEdge } from '../../core/graph-layout.js';
import type { ClassifierGeo } from './layout.js';
import { getSplitted } from '../../core/klimt/creole/Fission.js';
import type { CreoleAtom } from '../../core/klimt/creole/atom/Atom.js';
// Reused from the description engine (no cycle: description/ never imports
// class/) — `usecase`/`mix_actor` leaves under allowmixing use the SAME
// USymbol sizing formulas as their standalone descdiagram counterparts.
import { measureActor, measureUsecase } from '../description/leaf-sizing.js';
import { measureObjectClassifier } from './class-object-map-sizing.js';
import { measureMapClassifier } from './class-map-sizing.js';
import { resolveClassTagCascadeEntry } from '../../core/style-cascade-class.js';
import { measureJsonClassifier } from './class-json-sizing.js';
import { isCollapsedGroup } from './class-magma.js';
import {
  measureEmptyPackageLeafDim,
  type EmptyPackageLeafDim,
} from './class-namespace-shape.js';
import {
  hasBadge,
  badgeBoxHeight,
  badgeBoxWidth,
  resolveBadgeRadius,
  NAME_MARGIN_TOTAL,
  computeHeaderSlack,
} from './class-badge.js';
import {
  resolveVisibleStereotypeLabels,
  resolveStyleStereotypeTags,
  measureStereoLabelWidths,
  stereoBlockDim,
  buildStereoRows,
  buildHeaderRows,
  computeHeaderInfo,
  parseCircledCharDecoration,
  measureGenericTagDim,
  buildGenericTagGeo,
  CLASS_STEREOTYPE_FONT_SIZE,
  type GuillemetPair,
  type GenericTagGeo,
} from './class-stereotype.js';
import { LOLLIPOP_SIZE } from './class-lollipop.js';
import { javaRound4 } from '../../core/number-format.js';
import type { SpriteRegistry } from '../../core/sprite-commands.js';
import {
  ROW_TEXT_LEFT_MARGIN,
  isMethodMember,
  sectionHeight,
  buildSectionRows,
  sectionWidth,
  buildWrappedSectionRowBuilds,
  type SectionRowContext,
} from './class-member-rows.js';
import { isEnhancedBody } from './class-body-enhanced.js';
import { measureEnhancedBody, type EnhancedBodyGeo } from './class-body-enhanced-layout.js';
import { ARROW_GLYPH_SIZE, parseMagicArrowLabel } from './class-magic-arrow.js';
// Re-exported for existing external consumers (class-directives.ts, layout.ts,
// note-layout.ts) -- G2/N14 moved the implementations to class-member-rows.ts
// to keep this file under the 500-line cap; the public import path is unchanged.
export { ROW_TEXT_LEFT_MARGIN, isMethodMember };

/** SvekEdge.CONSTRAINT_SPOT (SvekEdge.java:122): the fixed side length of the
 *  10x10 label spot emitted for a `constraint on links` edge with no text. */
const CONSTRAINT_SPOT = 10;

/**
 * `plantuml.skin`'s `arrow { FontSize 13 }` block (`svek/GraphvizImageBuilder
 * .java#getStyleArrowCardinality` resolves the `arrow.cardinality` style,
 * which falls through to the plain `arrow` block -- no diagram in the corpus
 * overrides `cardinality` specifically), jar-verified against every sampled
 * `<text font-size="13">` multiplicity/role glyph in `test-results/dot-cache
 * /class/*` `in.svg`. G2/N25: used for the label's REAL rendered size
 * (`class-geo-builders.ts#attachPortLabels`'s baseline conversion + the
 * `textLength` this port's own `renderer.ts` emits) and for graphviz-ts's
 * own placement search (`core/graph-layout.ts#CARDINALITY_FONT_SIZE`, an
 * independent same-value constant in that module -- core/ does not import
 * class-local constants). NOT the same font `edgeLabelAttrs` below measures
 * with for DOT-gate sizing (`font` param, `theme.fontSize` = 14) -- that is
 * a pre-existing, separate, NOT-fixed-this-iteration mismatch (the DOT-gate
 * comparator never numeric-checks `taillabel`/`headlabel` table dims, so it
 * has never surfaced as a gate failure); left untouched to avoid ANY risk
 * to the frozen DOT gate.
 */
export const CARDINALITY_FONT_SIZE = 13;

/** G2 item 43: the alignment a `\\n`/`\\l`/`\\r`-split edge label resolves
 *  to -- see {@link splitEdgeLabelLines}'s doc comment. */
export type EdgeLabelAlign = 'center' | 'left' | 'right';

export interface EdgeLabelLines {
  lines: string[];
  align: EdgeLabelAlign;
}

/**
 * G2 item 43: split a relationship label's `\\n`/`\\l`/`\\r` line-break
 * escape sequences into individual lines, mirroring jar's
 * `Display#getWithNewlines` (`klimt/creole/Display.java:259-343`,
 * `Pragma.legacyReplaceBackslashNByNewline()` always `true`). `\\n` breaks
 * the line with no alignment change; `\\l`/`\\r` ALSO break the line and
 * additionally set the WHOLE block's horizontal alignment (the LAST
 * `\\l`/`\\r` in the string wins -- jar's `naturalHorizontalAlignment`
 * field is overwritten on each occurrence, not tracked per-line).
 * `\\t` -> a literal tab (`current.append('\t')`); `\\\\` -> a literal
 * backslash; any OTHER `\\x` pair is kept AS-IS (jar's trailing `else`
 * branch appends both characters unchanged, Display.java:308-310). Default
 * alignment (no `\\l`/`\\r` present) is CENTER
 * (`SvekEdge#getMessageTextAlignment` -> `getDefaultTextAlignment(CENTER)`,
 * SvekEdge.java:376-381). Jar-verified against `sicile-99-pefa679`'s 3
 * sibling edges (identical 3-line text, one `\\n`/`\\l`/`\\r` each).
 * Deliberately narrower than `Display.java`'s full state machine (no
 * `<math>`/`<latex>`/`[[`-raw-mode gating, no `%newline()`/`%n()` macro
 * forms, no `Jaws`-internal control-char handling) -- those branches are
 * unreached by any grep-confirmed edge-label fixture in this mission's
 * corpus (`ledger.md` item 43's own reach survey).
 */
export function splitEdgeLabelLines(text: string): EdgeLabelLines {
  const lines: string[] = [];
  let current = '';
  let align: EdgeLabelAlign = 'center';
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '\\' && i < text.length - 1) {
      const c2 = text[i + 1]!;
      i++;
      if (c2 === 'n' || c2 === 'r' || c2 === 'l') {
        if (c2 === 'r') align = 'right';
        else if (c2 === 'l') align = 'left';
        lines.push(current);
        current = '';
      } else if (c2 === 't') {
        current += '\t';
      } else if (c2 === '\\') {
        current += c2;
      } else {
        current += c + c2;
      }
    } else {
      current += c;
    }
  }
  lines.push(current);
  return { lines, align };
}

/**
 * G2 N65 item 35: word-wraps ONE already-`\\n`/`\\l`/`\\r`-split line
 * (`splitEdgeLabelLines`'s own output) via the SAME Fission engine E2r built
 * for description word-wrap (`Fission.ts#getSplitted`) -- upstream mirror:
 * `EntityImageClassHeader.java:108`'s `Display#create8(..., styleHeader
 * .wrapWidth())` call runs `Fission#getSplitted` on EACH already-newline-
 * split `CharSequence` independently (`Display.getWithNewlines` splits
 * first, `create8` wraps each resulting line second -- the two mechanisms
 * compose, never interact). A classifier header carries no creole markup
 * today (item 48, unattempted -- a header's `**bold**`/`<color:>` runs
 * render as literal text, not interpreted), so this wraps a SINGLE
 * synthetic plain-text `CreoleAtom` per line rather than a real multi-atom
 * sequence -- `getSplitted`'s own word-boundary scan (`Neutron
 * .getNeutronTypeFromChar`) operates identically on a lone text atom either
 * way. `maxWidth<=0` (no `MaximumWidth` cascade in effect) short-circuits to
 * `[text]`, byte-identical to pre-item-35 behavior.
 */
export function wrapPlainTextLine(
  text: string,
  fontSpec: { readonly family: string; readonly size: number },
  maxWidth: number,
  measurer: StringMeasurer,
): readonly string[] {
  if (maxWidth <= 0) return [text];
  const atom: CreoleAtom = {
    kind: 'text', text,
    font: { family: fontSpec.family, size: fontSpec.size, color: null, styles: new Set() },
  };
  const wrapped = getSplitted(
    [atom], maxWidth, (a) => (a.kind === 'text' ? measurer.measure(a.text, fontSpec).width : 0),
  );
  return wrapped.map((lineAtoms) => lineAtoms.filter((a) => a.kind === 'text').map((a) => a.text).join(''));
}

/**
 * Edge label attributes from a relationship's label + multiplicities. The Svek
 * comparator counts edges carrying each label kind (labelOk), so a relationship
 * label emits `label`, the from-side multiplicity emits `taillabel`, and the
 * to-side multiplicity emits `headlabel` (widths/heights are measured but
 * tolerant). The emitter needs only the sizes for tail/head — no text field.
 *
 * G2 item 43: a `\\n`/`\\l`/`\\r`-split multi-line label reserves the
 * WIDEST line's width and the full stacked height (`lines.length *` the
 * single-line measured height) instead of measuring the raw string (which
 * would count the literal `\\n`/`\\l`/`\\r` characters as visible glyphs
 * and never reflect the real multi-row reserved space) -- feeds graphviz-ts's
 * OWN layout/label-placement search with the true reserved box size, matching
 * jar's own `dimNote = labelText.calculateDimension(...)` over the FULL
 * multi-line `TextBlock` (`SvekEdge.java:440`). DOT-gate safe: the frozen
 * comparator's `labelOk` only counts label PRESENCE, never numeric
 * width/height (`tests/oracle/svek-dot.ts#compareStructural`, confirmed via
 * direct source read before this change).
 *
 * G2 item 44: a single-line label carrying a magic-arrow token (`class-
 * magic-arrow.ts#parseMagicArrowLabel`) reserves `ARROW_GLYPH_SIZE` (the
 * glyph's own fixed box) PLUS the stripped text's own width/height --
 * `TextBlockUtils.mergeLR`'s width-sums/height-maxes semantics
 * (`SvekEdge.java:284,304`), NOT the raw string's width (which would count
 * the literal `>`/`<` token as a visible glyph and never reserve space for
 * the triangle).
 */
export function edgeLabelAttrs(
  rel: Relationship,
  font: { family: string; size: number },
  measurer: StringMeasurer,
): NonNullable<DotInputEdge['attributes']> {
  const attrs: NonNullable<DotInputEdge['attributes']> = {};
  if (rel.label !== undefined) {
    attrs.label = rel.label;
    const { lines } = splitEdgeLabelLines(rel.label);
    if (lines.length > 1) {
      const widths = lines.map((l) => measurer.measure(l, font).width);
      const lineHeight = measurer.measure(lines[0] ?? '', font).height;
      attrs.labelWidth = Math.max(...widths);
      attrs.labelHeight = lineHeight * lines.length;
    } else {
      const magic = parseMagicArrowLabel(rel.label);
      if (magic !== undefined) {
        const m = magic.text !== undefined && magic.text !== ''
          ? measurer.measure(magic.text, font)
          : { width: 0, height: 0 };
        attrs.labelWidth = ARROW_GLYPH_SIZE + m.width;
        attrs.labelHeight = Math.max(ARROW_GLYPH_SIZE, m.height);
      } else {
        const m = measurer.measure(rel.label, font);
        attrs.labelWidth = m.width;
        attrs.labelHeight = m.height;
      }
    }
  } else if (rel.linkConstraint === true) {
    // `constraint on links` puts a fixed 10x10 spot label on a constrained
    // edge with no note/label text (SvekEdge.java:430-444: `hasNoteLabelText()
    // || link.getLinkConstraint() != null` → dimNote = CONSTRAINT_SPOT, the
    // 10x10 XDimension2D at SvekEdge.java:122). With a real label the normal
    // measured branch above already matches upstream's hasNoteLabelText arm.
    attrs.label = '';
    attrs.labelWidth = CONSTRAINT_SPOT;
    attrs.labelHeight = CONSTRAINT_SPOT;
  }
  if (rel.fromMultiplicity !== undefined) {
    const m = measurer.measure(rel.fromMultiplicity, font);
    attrs.tailLabelWidth = m.width;
    attrs.tailLabelHeight = m.height;
    // G2/N25: the actual text, fed into the real graphviz-ts layout call so
    // it computes a real position (`core/graph-layout.ts
    // #extractPortLabelPositions`) -- see that field's own doc comment.
    attrs.tailLabel = rel.fromMultiplicity;
  }
  if (rel.toMultiplicity !== undefined) {
    const m = measurer.measure(rel.toMultiplicity, font);
    attrs.headLabelWidth = m.width;
    attrs.headLabelHeight = m.height;
    attrs.headLabel = rel.toMultiplicity;
  }
  return attrs;
}

/**
 * Classifiers that svek wraps in a `shape=plaintext` HTML table because a
 * relationship attaches a `[Qualifier]` shield or a `::member` port to them.
 * Maps the classifier id to whether it is a PORT target (port table) vs a
 * qualifier shield — both emit `shape=plaintext`, differing only in the table.
 */
/**
 * Package/namespace ids used as a relationship endpoint OR a `note <pos> of
 * <package>` target. svek routes such an edge to a `zaent` point anchor
 * INSIDE that cluster (ClusterDotString) instead of drawing a separate node
 * for the package. Maps the endpoint id → anchor id. Only populated when a
 * namespace id actually appears as an endpoint/note-target, so the transform
 * is a no-op for every diagram that does not hit this case.
 */
export function packageEndpointAnchors(
  ast: ClassDiagramAST,
  clusterNsIds: ReadonlySet<string>,
): Map<string, string> {
  // Only a NON-EMPTY package (an actual cluster) gets an anchor; an empty
  // package used as an endpoint stays a plain rect node (oracle: mujopi p1/p3).
  const anchors = new Map<string, string>();
  for (const rel of ast.relationships) {
    if (clusterNsIds.has(rel.from)) anchors.set(rel.from, `zaent-${rel.from}`);
    if (clusterNsIds.has(rel.to)) anchors.set(rel.to, `zaent-${rel.to}`);
  }
  for (const note of ast.notes) {
    if (note.target !== undefined && clusterNsIds.has(note.target)) {
      anchors.set(note.target, `zaent-${note.target}`);
    }
  }
  return anchors;
}

export function shieldedClassifierIds(ast: ClassDiagramAST): Map<string, { isPort: boolean }> {
  const shielded = new Map<string, { isPort: boolean }>();
  const mark = (id: string, isPort: boolean): void => {
    const existing = shielded.get(id);
    if (existing === undefined) shielded.set(id, { isPort });
    else if (isPort) existing.isPort = true;
  };
  for (const rel of ast.relationships) {
    if (rel.fromPort !== undefined) mark(rel.from, true);
    if (rel.toPort !== undefined) mark(rel.to, true);
    if (rel.fromQualifier !== undefined) mark(rel.from, false);
    if (rel.toQualifier !== undefined) mark(rel.to, false);
  }
  return shielded;
}


/**
 * Format a member text string for class/interface/enum members (no
 * visibility prefix). G2 N4: the `: <type>` suffix is OMITTED entirely
 * when `type` is `undefined` (no `:` in the source line at all) -- was
 * unconditional (`: ${type ?? ''}`, always printing at least a bare
 * trailing colon), jar-verified against `jobuco-44-zife032`/`nubisa-82-
 * tuji339` (`class Foo { Bar }` -> jar's member row text is plain `"Bar"`,
 * never `"Bar: "`). Upstream stores each member line close to verbatim
 * (`cucadiagram/Member.java` -- a raw `CharSequence` wrapper, not a
 * name/type reconstruction), so a field/method the user wrote with no `:
 * Type` at all should round-trip with no `:` either -- this port's AST
 * splits name/type/params at parse time, so `formatMemberText` is the
 * reconstruction point that must reproduce that same "nothing typed,
 * nothing shown" behavior.
 */
export function formatMemberText(member: {
  visibility: string;
  name: string;
  type?: string;
  /** G2 N31: the raw separator between name/params and `type`, when the
   *  source used something other than the canonical `': '` -- see
   *  `ast.ts#Member.typeSeparator`'s doc comment. */
  typeSeparator?: string;
  params?: string[];
  rawDisplay?: string;
}): string {
  // G2 N12: a raw-fallback member (class-member-parser.ts's non-canonical-
  // syntax branch) carries its ENTIRE display text verbatim in `rawDisplay`
  // -- `name` duplicates it only so callers that key on `.name` still see
  // something -- so it must win over the structured name/type/params
  // reconstruction below (mirrors `class-object-map-sizing.ts#
  // formatObjectMemberText`'s identical `rawDisplay`-first precedence for
  // object leaves, the same upstream Member/BodierLikeClassOrObject
  // mechanism).
  if (member.rawDisplay !== undefined) return member.rawDisplay;
  const typeSuffix = member.type !== undefined ? `${member.typeSeparator ?? ': '}${member.type}` : '';
  if (member.params !== undefined) {
    return `${member.name}(${member.params.join(', ')})${typeSuffix}`;
  }
  return `${member.name}${typeSuffix}`;
}

/** Pre-measured classifier dimensions and row/divider layout (no layout coordinates). */
export interface MeasuredClassifier {
  width: number;
  height: number;
  rows: ClassifierGeo['rows'];
  dividerYs: number[];
  /** G2 N24: number of LEADING `rows[]` entries that belong to the header
   *  bundle (stacked stereotype line(s) + the name row), rather than the
   *  member/body section -- `renderer-classifier-box.ts#buildHeaderPrimitive`/
   *  `#buildBodyPrimitives` read this to know how many rows to draw as part
   *  of the header vs. as member/body rows. Omitted (defaults to 1, the
   *  pre-N24 assumption of exactly one header row) for every classifier with
   *  no stereotype -- zero behavior change for the common case, and for
   *  `object`/`map`/`json` leaves (their own separate, unaffected header
   *  convention, `class-object-map-sizing.ts#headerRows`). */
  headerRowCount?: number;
  /** G2 N64 item 45: number of TRAILING `headerRowCount` rows that are
   *  classifier-NAME lines (a multi-line `\n`/`\l`/`\r`-split display
   *  name), rather than genuine stacked `<<stereotype>>` label rows.
   *  `renderer-classifier-box.ts#buildHeaderPrimitive` uses this to decide
   *  which leading rows get the stereotype-label font-color-cascade
   *  treatment (`isStereoLabelRow`) -- omitted (defaults to 1, the
   *  pre-N64 assumption of exactly one name row) for every classifier
   *  whose display name has no line-break escape. */
  nameRowCount?: number;
  /** G2 N26: `class Foo << (F,orange) >>`'s badge-customization override --
   *  see `class-stereotype.ts#parseCircledCharDecoration`'s doc comment.
   *  Omitted for every classifier with no `(CHAR[,COLOR])` decoration. */
  badgeChar?: string;
  badgeColor?: string;
  /** G2 N32: `class Foo<T>`'s generic type-parameter tag box -- see
   *  `class-stereotype.ts#buildGenericTagGeo`'s doc comment. Omitted for
   *  every classifier with no `typeParams` (zero behavior change). */
  genericTag?: GenericTagGeo;
  /** G2 N33: present only for a collapsed-empty `package`/`namespace` leaf
   *  (`class-magma.ts#isCollapsedGroup`) -- see
   *  `class-namespace-shape.ts#measureEmptyPackageLeafDim`'s doc comment.
   *  `renderer.ts` reads this to draw the folder-tab icon UNWRAPPED instead
   *  of the generic classifier box. */
  folderTab?: EmptyPackageLeafDim;
  /** G2 N42: present only for a classifier whose body triggers upstream's
   *  "enhanced body" render strategy (`class-body-enhanced.ts
   *  #isEnhancedBody`) -- a `--`/`==`/`..`/`__` block separator or a `|_`
   *  tree-list line. `renderer-classifier-box.ts#buildBodyPrimitives`
   *  draws this INSTEAD OF the classic fields/methods `dividerYs`/`rows`
   *  split (both fields still populated for backward-compat parity with
   *  every other `MeasuredClassifier`, but left EMPTY-equivalent for an
   *  enhanced classifier -- `rows` carries only the header bundle). */
  enhancedBody?: EnhancedBodyGeo;
}

/**
 * G2 N32: one resolved `{family, size, bold, italic}` font per role -- see
 * `theme.ts#classFontSize`'s doc comment for the header-vs-attribute
 * cascade `measureClassifier` builds this from.
 */
interface ClassFontSpecs {
  header: { family: string; size: number; bold: boolean; italic: boolean };
  attribute: { family: string; size: number; bold: boolean; italic: boolean };
}

/**
 * Measure the generic name+members box (class/interface/enum/annotation/…
 * every kind not intercepted above measureClassifier's dispatch). Split out
 * purely to keep measureClassifier under the project's per-function NLOC cap.
 *
 * Width/height formulas mirror `EntityImageClassHeader`/`HeaderLayout`/
 * `MethodsOrFieldsArea` (see `class-badge.ts`'s doc comment for the header
 * geometry derivation; jar-verified, `plans/g2-class-svg/ledger.md` N3) —
 * replaces the previous ad hoc `Math.max(100, longestWidth + 20)` floor,
 * which upstream has no equivalent of (`MinimumWidth`/`SameClassWidth`
 * default to 0).
 */
function measureGenericClassifier(
  classifier: Classifier,
  fonts: ClassFontSpecs,
  measurer: StringMeasurer,
  suppress: MemberSuppression,
  // G2 N27: `sprites` + the new `guillemet` override folded into one
  // trailing options object -- this function was already at the repo's
  // 5-param cap (`~/.claude/hooks/check-complexity.py#MAX_PARAMS`), so a
  // bare 6th positional param isn't available. G2 N38: `badgeRadius` --
  // pre-resolved by the caller (`measureClassifier`, which has `theme`)
  // via `resolveBadgeRadius`, since this function has no `Theme` param of
  // its own.
  options: {
    sprites: SpriteRegistry | undefined;
    guillemet?: GuillemetPair | undefined;
    badgeRadius: number;
    /** G2 N39: `skinparam classStereotypeFontSize`/`FontName`/`FontStyle`
     *  -- pre-resolved by the caller (`measureClassifier`, which has
     *  `theme`), mirroring `badgeRadius`'s own precedent above. */
    stereoFont: { family: string; size: number; bold: boolean; italic: boolean };
    /** G2 N58 item 40: `skinparam style strictuml` -- `CucaDiagram#showPortion`'s
     *  UNCONDITIONAL `EntityPortion.CIRCLED_CHARACTER` guard (`if
     *  (getSkinParam().strictUmlStyle() && portion == CIRCLED_CHARACTER) return
     *  false;`, checked BEFORE any hide/show command) -- pre-resolved by the
     *  caller (`measureClassifier`, which has `theme`), mirroring `badgeRadius`'s
     *  own "resolve once, pass down" precedent above. */
    strictUml: boolean;
    /** G2 N65 item 35: `<style> class { MaximumWidth N } }` -- pre-resolved
     *  by the caller (`measureClassifier`, which has `theme`), mirroring
     *  `badgeRadius`'s own "resolve once, pass down" precedent above. `0` =
     *  no wrap (see `theme.ts#classCascadeMaximumWidth`'s own doc comment). */
    headerMaxWidth: number;
    memberMaxWidth: number;
  },
): MeasuredClassifier {
  const { sprites, guillemet, badgeRadius, stereoFont, strictUml, headerMaxWidth, memberMaxWidth } = options;
  // G2 N32: `fontSpec` (unchanged name -- the pre-existing "generic"
  // classifier font) is now specifically the ATTRIBUTE/member-row font;
  // `headerFont` is the classifier HEADER's own, independently-overridable
  // font -- see `theme.ts#classFontSize`'s doc comment for the jar-verified
  // cascade (`measureClassifier` below builds both, header falling back to
  // attribute, matching `FromSkinparamToStyle.java:185-191`'s style-selector
  // specificity: `element.class.header` cascades from `element.class` when
  // it carries no override of its own).
  const { header: headerFont, attribute: fontSpec } = fonts;
  const badgeShown = hasBadge(classifier.kind) && classifier.hideCircle !== true && !strictUml;
  const memberRowHeight = fontSpec.size;
  const header = computeHeaderInfo(classifier);
  // G2 N26: `class Foo << (F,orange) >>`'s badge-customization override --
  // computed once here (not per-render) so BOTH `buildClassifierGeos` and
  // `degenerateSingleClassifier` (class-geo-builders.ts) can copy it
  // straight off the SAME `MeasuredClassifier`, mirroring `headerRowCount`'s
  // established precedent.
  const circledChar = parseCircledCharDecoration(classifier.stereotype);
  const badgeCharField = circledChar !== undefined ? { badgeChar: circledChar.char } : {};
  const badgeColorField = circledChar?.color !== undefined ? { badgeColor: circledChar.color } : {};
  // G2 N4: rounded via the SAME Java-%.4f rounding jar's own `SvgGraphics#
  // format` applies before emitting `textLength` -- a raw JS double's
  // shortest round-trip decimal (e.g. `24.150000000000002`) fails an exact
  // string comparison against jar's `"24.15"` even though `compareSvg`'s
  // numeric tolerance would forgive the SAME magnitude of drift on a
  // NUMERIC_ATTRS-listed attribute (`textLength` is not one -- test-harness
  // scope, not touched here; see `core/number-format.ts`'s own doc comment).
  //
  // G2 N64 item 45: a classifier display name can itself carry `\n`/`\l`/
  // `\r` line-break escapes (`class "User\n(...)" as user`) -- jar routes
  // it through the SAME `Display.getWithNewlines` state machine a
  // relationship label uses (`CommandCreateClass.java:191`, item 43's own
  // jar citation), so `splitEdgeLabelLines` (already defined in THIS file)
  // is reused verbatim rather than porting a second copy of that state
  // machine. `headerTextWidth` becomes the WIDEST line's own width (was the
  // raw, possibly-escape-embedded string's width -- counted the literal
  // `\`/`n` characters as visible glyphs pre-fix, same bug shape item 43
  // fixed for edge labels).
  const rawHeaderSplit = splitEdgeLabelLines(header.headerText);
  // G2 N65 item 35: word-wraps EACH already-`\n`/`\l`/`\r`-split line via
  // `wrapPlainTextLine` (Fission) when a `MaximumWidth` cascade is in
  // effect -- see that function's own doc comment. `headerLines.length`
  // downstream (headerRowHeight, buildHeaderRows, buildStereoRows'
  // nameLineHeight) ALREADY generalizes to N lines (item 45, N64), so no
  // further change is needed past this one substitution -- algebraically a
  // no-op at `headerMaxWidth<=0` (the overwhelming majority of classifiers).
  const headerLines = headerMaxWidth > 0
    ? rawHeaderSplit.lines.flatMap((l) => wrapPlainTextLine(l, headerFont, headerMaxWidth, measurer))
    : rawHeaderSplit.lines;
  const headerAlign = rawHeaderSplit.align;
  const headerLineWidths = headerLines.map((l) => javaRound4(measurer.measure(l, headerFont).width));
  const headerTextWidth = Math.max(...headerLineWidths);
  const nameWidth = headerTextWidth + NAME_MARGIN_TOTAL;
  // G2 N64 (item 45 corollary): a trailing `\n` split can produce a BLANK
  // final line (`buildHeaderRows`'s own doc comment, jar-verified
  // `julixi-10-jide878`) -- pre-measure the NBSP substitution glyph's own
  // width ONCE here (the only place with a `measurer` reference at this
  // layer), mirroring `badgeRadius`/`stereoFont`'s own "resolve once, pass
  // down" precedent.
  const blankLineRenderWidth = javaRound4(measurer.measure('\u00A0', headerFont).width);
  // G2 N24: `HeaderLayout#getDimension`'s `stereoDim` term -- a classifier's
  // `<<stereotype>>` (possibly STACKED, `<<A>><<B>>`) draws as its own text
  // row(s) above the header name and can widen/heighten the header box.
  // Formula + jar evidence: `class-stereotype.ts`'s own doc comment.
  // G2 N24: `visibleStereotypeLabels` is pre-filtered by
  // `class-directives.ts#applyStereotypeHideShow` (`hide|show [<<pattern>>]
  // stereotype(s)`) -- fall back to an unfiltered split only for hand-built
  // test geometries that bypass that post-parse pass.
  const stereoLabels = resolveVisibleStereotypeLabels(classifier);
  const stereoLabelWidths = measureStereoLabelWidths(
    stereoLabels, stereoFont.family, measurer, guillemet, stereoFont.size,
  );
  const blockDim = stereoBlockDim(stereoLabelWidths, stereoFont.size);
  const circleWidth = badgeShown ? badgeBoxWidth(badgeRadius) : 0;
  const widthStereoAndName = Math.max(blockDim.width, nameWidth);
  // G2 N32: `class Foo<T>`'s generic type-parameter tag box -- widens/
  // heightens the header exactly like the stereotype block above (SAME
  // `HeaderLayout#getDimension` width-sum/height-max shape), see
  // `class-stereotype.ts`'s own "generic type-parameter TAG box" section
  // doc comment for the full jar derivation + DOT-gate verification. G2
  // N39: SAME `FontParam.CLASS_STEREOTYPE` the stereotype label row(s)
  // above use -- `stereoFont`, not `headerFont`.
  const genericDim = measureGenericTagDim(
    classifier.typeParams ?? [], stereoFont.family, measurer, stereoFont.size,
    classifier.typeParamsRawText,
  );
  // G2 N64 item 45: `headerLines.length * headerFont.size` generalizes the
  // pre-existing single-line `headerFont.size` term -- `HeaderLayout
  // #getDimension`'s `nameDim.height` is the MARGINED multi-line TextBlock's
  // OWN height, which for N same-size lines reduces to `N * font.size`
  // (every `measurer.measure(...).height === font.size` regardless of line
  // content, `measurer-deterministic.ts`'s own doc comment) -- jar-verified
  // against `dofima-22-kofe334`'s golden `38 = 2*14+10` header-divider
  // offset (`ledger.md` N64).
  const headerRowHeight = Math.max(
    badgeShown ? badgeBoxHeight(badgeRadius) : 0,
    blockDim.height + headerLines.length * headerFont.size + 10,
    genericDim?.height ?? 0,
  );
  const headerWidth = circleWidth + widthStereoAndName + (genericDim?.width ?? 0);
  // G2 N4: ascent-from-line-top -- the SAME baseline offset formula every
  // text row (header AND members) uses to convert a "line top" position into
  // its SVG `<text y="...">` baseline, mirroring the established `height -
  // descent` pattern (`core/svek/image/EntityImageDescriptionSupport.ts`'s
  // `measureLine`/`lineDescent`, line ~341's `baselineDy = m.height -
  // m.descent`). `getDescent` is content-independent for every measurer in
  // this codebase (that file's own doc comment), so an empty-string probe
  // is equivalent to probing the real header/row text. G2 N32: computed
  // TWICE (once per font) now that header/attribute fonts can diverge --
  // jar-verified `xabije-20-xusi569` (header size 14 vs attribute size 18,
  // each row's own baseline scales with its OWN font's descent).
  const headerBaselineOffset = headerFont.size - measurer.getDescent(headerFont, '');
  const memberBaselineOffset = fontSpec.size - measurer.getDescent(fontSpec, '');
  const stereoBaselineOffset = stereoFont.size -
    measurer.getDescent({ family: stereoFont.family, size: stereoFont.size }, '');

  // G2 N42: upstream's "enhanced body" render strategy (`--`/`==`/`..`/
  // `__` block separator or a `|_` tree-list line anywhere in the raw body)
  // REPLACES the classic fields/methods split entirely -- computed BEFORE
  // the classic split below so its own `memberAreaWidth` can feed the SAME
  // shared header-sizing code (badge/stereo/generic-tag) unchanged. See
  // `class-body-enhanced.ts#isEnhancedBody`'s own doc comment.
  //
  // G2 N44 (regression guard, `nirija-04-veti140`): `BodierLikeClassOrObject
  // #getBody`'s own enhanced branch is `if (showMethods || showFields) return
  // BodyFactory.create1(...); return null;` -- a classifier whose whole
  // member section is suppressed (`hide X members`, BOTH `suppress.fields`
  // AND `suppress.methods`) draws NO body at all, not the full enhanced-body
  // content. This port's dedent fix (`class-body-enhanced.ts#dedentRawLines`)
  // newly makes `isEnhancedBody` detect an indented `__ Messages __`
  // separator that used to be masked, which UNMASKED this pre-existing gap:
  // without the `!(suppress.fields && suppress.methods)` guard, a fully-
  // `hide members`-suppressed classifier with a NOW-detected enhanced body
  // would draw its full member content instead of headerRowHeight-only
  // (jar-verified: `nirija-04-veti140`'s `class X`/`class Y`, both `hide ...
  // members`, draw a bare header rect with zero body height).
  const enhancedBody = isEnhancedBody(classifier.rawBodyLines) && !(suppress.fields && suppress.methods)
    ? measureEnhancedBody(classifier.rawBodyLines!, {
        fontSpec, measurer, sprites, baselineOffset: memberBaselineOffset, bodyTop: headerRowHeight,
      })
    : undefined;

  // Only include visible (non-hidden) members in layout; split into the two
  // upstream compartments (fields first, then methods — declaration order
  // preserved within each, matching `getFieldsToDisplay`/`getMethodsToDisplay`).
  const visibleMembers = enhancedBody !== undefined ? [] : classifier.members.filter((m) => m.hidden !== true);
  const fields = visibleMembers.filter((m) => !isMethodMember(m));
  const methods = visibleMembers.filter(isMethodMember);
  const fieldTexts = fields.map(formatMemberText);
  const methodTexts = methods.map(formatMemberText);
  // G2 N22: each member's creole build (classify + atoms + measured width)
  // is computed ONCE here and reused for BOTH the section max-width scan
  // (`sectionWidth`) and the stored row (`buildSectionRows`) -- avoids
  // building/measuring the SAME row's atoms twice, and guarantees the
  // rendered atoms are EXACTLY the ones the width formula summed. G2 N65
  // item 35: now also word-wraps each member into 1+ rows when
  // `memberMaxWidth` is set (`class-member-rows.ts
  // #buildWrappedSectionRowBuilds`'s own doc comment) -- `.builds` stays a
  // FLAT array (one entry per RENDERED row, not per member), so
  // `sectionWidth` below needs zero changes (it already just scans every
  // build's own width regardless of which member it came from).
  const fieldFlat = buildWrappedSectionRowBuilds(fields, fieldTexts, fontSpec, measurer, memberMaxWidth, sprites);
  const methodFlat = buildWrappedSectionRowBuilds(methods, methodTexts, fontSpec, measurer, memberMaxWidth, sprites);
  const fieldRowBuilds = fieldFlat.builds;
  const methodRowBuilds = methodFlat.builds;
  // G2 N14: hasIcon is a per-SECTION scan (MethodsOrFieldsArea#hasSmallIcon),
  // fields and methods independent -- see sectionWidth's own doc comment.
  const fieldsHasIcon = fields.some((m) => m.visibilityExplicit === true);
  const methodsHasIcon = methods.some((m) => m.visibilityExplicit === true);

  // G2 N26 (pre-existing gap, unmasked while jar-verifying entity-scoped
  // `hide <entity> members`/`fields`/`methods`, which -- unlike every prior
  // `suppress.fields`/`.methods` caller -- can suppress a compartment that
  // still has real, wide member text): a SUPPRESSED compartment must not
  // contribute to the box width either -- jar-verified `nujiga-81-peno983`'s
  // `Dummy2` (methods suppressed, keeps its narrower fields-only width
  // 78.15, NOT the wider `+thisIsALongmethod1()` methods-driven 162.85
  // every OTHER classifier in that fixture uses). Every pre-existing caller
  // (`hide empty fields`/`hide empty methods`/global `hide members`) never
  // surfaced this because a suppressed compartment was always ALSO the
  // narrower (or empty) one in every ratchet-pinned sample to date.
  const memberAreaWidth = enhancedBody !== undefined ? enhancedBody.width : Math.max(
    suppress.fields ? 0 : sectionWidth(fieldRowBuilds, fieldsHasIcon),
    suppress.methods ? 0 : sectionWidth(methodRowBuilds, methodsHasIcon),
  );
  const width = Math.max(headerWidth, memberAreaWidth);
  // G2 N32: positioned against the FINAL box `width` (post member-content
  // max), matching `HeaderLayout#drawU`'s own `width` parameter -- see
  // `class-stereotype.ts#buildGenericTagGeo`'s doc comment for why this is
  // NOT `headerWidth` alone.
  const genericTagGeo = genericDim !== undefined
    ? buildGenericTagGeo(
        classifier.typeParams ?? [], genericDim, width, stereoFont.family, stereoBaselineOffset,
        stereoFont.size, stereoFont.bold, stereoFont.italic, classifier.typeParamsRawText,
      )
    : undefined;
  const genericTagField = genericTagGeo !== undefined ? { genericTag: genericTagGeo } : {};
  const { h1, h2 } = computeHeaderSlack(width, headerWidth, circleWidth);
  const { rows: stereoRows, nameTop } = buildStereoRows({
    labels: stereoLabels,
    labelWidths: stereoLabelWidths,
    fontFamily: stereoFont.family,
    circleWidth,
    widthStereoAndName,
    blockDim,
    h1,
    h2,
    headerRowHeight,
    nameLineHeight: headerLines.length * headerFont.size,
    stereoBaselineOffset,
    guillemet,
    fontSize: stereoFont.size,
    bold: stereoFont.bold,
    italic: stereoFont.italic,
  });
  const headerRows = buildHeaderRows({
    header, lines: headerLines, lineWidths: headerLineWidths, align: headerAlign,
    circleWidth, widthStereoAndName, nameWidth, h1, h2, nameTop,
    baselineOffset: headerBaselineOffset, fontSpec: headerFont, headerTextWidth, badgeRadius,
    blankLineRenderWidth,
  });
  // G2 N64 item 45: `headerRowCount` now also grows for a multi-line NAME
  // (not just stacked stereotype rows) -- `nameRowCount` (new field, default
  // 1) tells `renderer-classifier-box.ts#buildHeaderPrimitive` how many of
  // the TRAILING header rows are name lines (vs. genuine `<<stereotype>>`
  // label rows, which need a DIFFERENT font-color-cascade treatment --
  // `isStereoLabelRow`'s own doc comment).
  const totalHeaderRows = stereoRows.length + headerRows.length;
  const headerRowCountField = totalHeaderRows > 1 ? { headerRowCount: totalHeaderRows } : {};
  const nameRowCountField = headerRows.length > 1 ? { nameRowCount: headerRows.length } : {};

  // G2 N42: the enhanced-body box height is `headerRowHeight +
  // enhancedBody.height` -- upstream draws it as a SINGLE `TextBlockVertical`
  // stack (`BodyEnhanced1#getArea`), never split into the classic
  // fields/methods `dividerYs` pair, so `dividerYs` stays empty and every
  // divider/row primitive lives on `enhancedBody.parts` instead
  // (`renderer-body-enhanced.ts#renderEnhancedBody`). `hide`/`show`
  // per-compartment suppression is NOT consulted here -- zero corpus
  // overlap between `isEnhancedBody` and any `hide fields`/`hide methods`
  // directive in this iteration's target fixtures, a named, unverified gap
  // rather than a silently guessed formula.
  if (enhancedBody !== undefined) {
    return {
      width, height: headerRowHeight + enhancedBody.height, rows: [...stereoRows, ...headerRows],
      // `dividerYs[0]` is consulted by `renderer-classifier-box.ts
      // #renderBadge` for the header's own height (badge vertical center) --
      // populated with the SAME `headerRowHeight` the classic path's own
      // first divider uses, even though this single entry is otherwise
      // UNCONSUMED for body rendering (`buildBodyPrimitives`'s
      // `enhancedBody` branch returns before ever reaching the classic
      // dividerYs/rows Y-sort merge).
      dividerYs: [headerRowHeight],
      enhancedBody, ...headerRowCountField, ...nameRowCountField, ...badgeCharField, ...badgeColorField, ...genericTagField,
    };
  }

  // G2 N24 (pre-existing bug, unmasked while jar-verifying the stereo
  // formula on `cuxuni-25-doxi736`'s member-less `Dummy4 <<even>>`): a
  // fully-suppressed classifier's box height is `headerRowHeight` EXACTLY,
  // not `+4` -- jar-verified on BOTH a stereotype-bearing case (`Dummy4`,
  // rect height 36 = headerRowHeight) and a plain no-stereo case
  // (`xibibe-37-regi626`'s `class A` + `hide members`, rect height 32 =
  // headerRowHeight, was 36 before this fix). The old `+4` was never
  // correct; this branch had zero ratchet-pinned coverage before N24.
  if (suppress.fields && suppress.methods) {
    return {
      width, height: headerRowHeight, rows: [...stereoRows, ...headerRows], dividerYs: [],
      ...headerRowCountField, ...nameRowCountField, ...badgeCharField, ...badgeColorField, ...genericTagField,
    };
  }

  // G2 N10: each compartment (fields, methods) is suppressed INDEPENDENTLY --
  // `hide empty fields`/`hide empty methods`/`hide empty members` (the
  // latter expanding to BOTH per CommandHideShowByGender.java:267-279's
  // `emptyMembers` special case) hide only the compartment that is itself
  // empty, not the whole member section. A suppressed compartment draws NO
  // divider and contributes NO height (`BodierLikeClassOrObject#getBody`:
  // `showFields && !showMethods` returns `fields.asBlockMemberImpl()` alone
  // -- ONE divider, not two; jar-verified `mezucu-18-lozi106`: `hide empty
  // members` + a field-only class draws exactly one `<line>` divider, rect
  // height 54 not 62). When neither is suppressed (the default, no matching
  // hide directive), behavior is UNCHANGED from before this fix: both
  // compartments always draw their own divider even when empty
  // (`EMPTY_SECTION_HEIGHT`'s doc comment, G2 N3).
  // G2 N65 item 35: total FLAT row count (may exceed `fields.length`/
  // `methods.length` when a member wraps into multiple rows), not the
  // member count -- see `buildWrappedSectionRowBuilds`'s own doc comment.
  const fieldsH = suppress.fields ? 0 : sectionHeight(fieldFlat.builds.length, memberRowHeight);
  const methodsH = suppress.methods ? 0 : sectionHeight(methodFlat.builds.length, memberRowHeight);
  const height = headerRowHeight + fieldsH + methodsH;
  const rows: ClassifierGeo['rows'] = [...stereoRows, ...headerRows];
  const dividerYs: number[] = [];
  const rowCtx: SectionRowContext = { memberRowHeight, baselineOffset: memberBaselineOffset };
  if (!suppress.fields) {
    dividerYs.push(headerRowHeight);
    rows.push(
      ...buildSectionRows(fieldFlat.members, fieldFlat.texts, fieldFlat.builds, headerRowHeight, fieldsHasIcon, rowCtx),
    );
  }
  if (!suppress.methods) {
    dividerYs.push(headerRowHeight + fieldsH);
    rows.push(
      ...buildSectionRows(
        methodFlat.members, methodFlat.texts, methodFlat.builds, headerRowHeight + fieldsH, methodsHasIcon, rowCtx,
      ),
    );
  }
  return {
    width, height, rows, dividerYs,
    ...headerRowCountField, ...nameRowCountField, ...badgeCharField, ...badgeColorField, ...genericTagField,
  };
}

/** Measure the usecase/actor USymbol box — the two allowmixing kinds whose
 *  svek box is NOT the generic name+members rect (see measureClassifier). */
function measureUsecaseOrActor(
  classifier: Classifier,
  fontSpec: { family: string; size: number },
  measurer: StringMeasurer,
): MeasuredClassifier {
  const dim = classifier.kind === 'usecase'
    ? measureUsecase(classifier.display, fontSpec, measurer)
    : measureActor(classifier.display, fontSpec, measurer);
  const row = { text: classifier.display, y: dim.height / 2, indent: 0, italic: false };
  return { width: dim.width, height: dim.height, rows: [row], dividerYs: [] };
}

/**
 * G2 N20: the lollipop interface's own display-label text --
 * `EntityImageLollipopInterface.java:94-133`'s `desc.drawU(...)` call, drawn
 * OUTSIDE the circle's own `<g class="entity">` wrap (`renderer.ts`'s
 * `renderLollipop` pushes this row's rendered `<text>` as an unwrapped
 * sibling, mirroring jar's own `closeGroup()`-then-`desc.drawU(...)`
 * sequence). Jar never reserves DOT/layout space for it --
 * `calculateDimensionSlow` returns a flat `(SIZE, SIZE)` ignoring `desc`
 * entirely (`class-dot-graph.ts#buildOneDotNode`'s own "generic width/
 * height discarded" doc comment is the matching DOT-side half of this
 * fact) -- so `width`/`height` returned here are informational only, never
 * consulted for node sizing.
 *
 * Byte-verified against `bososa-44-fipu544`'s `dummylol2` ("toto1"): jar's
 * `<text x="6" y="26.8889" ... textLength="31.0625">toto1</text>` = node-left
 * `16.5313` + `(SIZE/2 - textWidth/2)` = `16.5313 + (5 - 15.53125)`, node-top
 * `6 + SIZE(10) + baselineOffset(10.8889)` -- `baselineOffset` is the SAME
 * ascent-from-line-top formula (`fontSpec.size - measurer.getDescent(...)`)
 * every other class text row uses (`measureGenericClassifier`'s own doc
 * comment).
 */
function measureLollipop(
  classifier: Classifier,
  fontSpec: { family: string; size: number },
  measurer: StringMeasurer,
): MeasuredClassifier {
  const textWidth = javaRound4(measurer.measure(classifier.display, fontSpec).width);
  const baselineOffset = fontSpec.size - measurer.getDescent(fontSpec, '');
  const row = {
    text: classifier.display,
    y: LOLLIPOP_SIZE + baselineOffset,
    indent: LOLLIPOP_SIZE / 2 - textWidth / 2,
    width: textWidth,
  };
  return { width: LOLLIPOP_SIZE, height: LOLLIPOP_SIZE, rows: [row], dividerYs: [] };
}

/**
 * Per-compartment hide state for a classifier's member section (G2 N10).
 * `fields`/`methods` are independent: `hide empty fields`/`hide empty
 * methods` set exactly one; `hide empty members` (upstream's `emptyMembers`
 * special case, CommandHideShowByGender.java:267-279) sets whichever
 * compartment is itself empty for a given classifier -- possibly both,
 * possibly neither, possibly just one. `hide members` (bare, unconditional)
 * sets both regardless of emptiness.
 */
export interface MemberSuppression {
  fields: boolean;
  methods: boolean;
}

/**
 * Compute the pre-measured dimensions and row/divider layout for a classifier.
 * Members with hidden=true are excluded from height calculations and row output.
 *
 * @param suppress - Per-compartment suppression (see `MemberSuppression`). A
 *   suppressed compartment omits its divider + rows + height entirely,
 *   independent of the other compartment (G2 N10 — was previously a single
 *   boolean that suppressed BOTH or neither, wrong per
 *   `CommandHideShowByGender.java`'s per-portion `emptyMembers` expansion).
 */
export function measureClassifier(
  classifier: Classifier,
  theme: Theme,
  measurer: StringMeasurer,
  suppress: MemberSuppression,
  sprites?: SpriteRegistry,
): MeasuredClassifier {
  // object/map/json leaves are NOT the generic name+members box — each has
  // its own upstream-faithful formula (EntityImageObject / EntityImageMap /
  // EntityImageJson + TextBlockMap / TextBlockCucaJSon). Objects have no
  // methods compartment concept (`BodierLikeClassOrObject#getFieldsToDisplay`
  // routes EVERY object member into "fields" regardless of method-like
  // syntax) — only `suppress.fields` is meaningful for them.
  // G2 N33: a collapsed-empty `package`/`namespace` draws its OWN small
  // folder-tab icon (`EntityImageEmptyPackage`), never the generic
  // name+members box -- must be checked before every other branch below
  // since `isCollapsedGroup` classifiers carry `kind: 'descriptive'` with
  // no `usymbol` (would otherwise fall through to the generic box at the
  // bottom of this function).
  if (isCollapsedGroup(classifier)) {
    const dim = measureEmptyPackageLeafDim(measurer, theme, classifier.display);
    // `rows[0].text` carries the label for `renderer.ts#renderEmptyPackageLeaf`
    // (mirrors `tryRenderUSymbol`'s identical `rows[0]?.text ?? id` convention)
    // -- no `y`/`indent` meaning here since this leaf never draws through the
    // generic `renderRow` path.
    return {
      width: dim.width, height: dim.height, dividerYs: [],
      rows: [{ text: classifier.display, y: 0, indent: 0 }],
      folderTab: dim,
    };
  }
  if (classifier.kind === 'object') {
    return measureObjectClassifier(classifier, theme, measurer, suppress.fields);
  }
  if (classifier.kind === 'map') {
    return measureMapClassifier(classifier, theme, measurer);
  }
  if (classifier.kind === 'json') {
    return measureJsonClassifier(classifier, theme, measurer);
  }
  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  // usecase (LeafType.USECASE) and the `actor` descriptive leaf are the two
  // allowmixing kinds whose svek box is NOT the generic name+members rect —
  // upstream sizes them via EntityImageDescription's USymbol-specific
  // formula (ContainingEllipse / ActorStickMan+label), ported in the
  // description engine's leaf-sizing.ts. Every other descriptive leaf
  // (database/component/rectangle) keeps the generic box below unchanged.
  if (classifier.kind === 'usecase' || (classifier.kind === 'descriptive' && classifier.usymbol === 'actor')) {
    return measureUsecaseOrActor(classifier, fontSpec, measurer);
  }
  // G2 N20: the lollipop interface's own small circle+label -- NOT the
  // generic name+members box (see measureLollipop's own doc comment).
  if (classifier.kind === 'lollipop') {
    return measureLollipop(classifier, fontSpec, measurer);
  }
  // G2 N23/N32: `skinparam class { AttributeFontSize/AttributeFontName/
  // AttributeFontStyle }` (`FontParam.CLASS_ATTRIBUTE`) overrides the generic
  // classifier box's ATTRIBUTE (member-row) font -- style-mapped by
  // `FromSkinparamToStyle.java:190-193` to the `element.class` selector.
  // `skinparam classFontSize/classFontName/classFontStyle`
  // (`FromSkinparamToStyle.java:185-188`, `element.class.header`) is the
  // classifier HEADER's own, independently-overridable font, which CASCADES
  // from the attribute-level values above when unset (CSS-selector-
  // specificity semantics) -- jar-verified two ways: `jisanu-32-gado231`
  // (attribute-only override) shows the header ALSO adopting the overridden
  // size/family; `xabije-20-xusi569` (BOTH set, to DIFFERENT values) shows
  // the header using its OWN `classFont*` values instead. Scoped to the
  // generic name+members box only (usecase/actor/lollipop above use their
  // own unrelated upstream FontParams, unaffected).
  // G2 N37: `.tagname` `<style>` cascade FontStyle -- resolved ONCE here
  // (not per-render) since a classifier's OWN stereotype never changes
  // between layout and render. Folds into BOTH attribute and header
  // bold/italic (jar-verified `dozude-05-jeve029`: the tag's `FontStyle
  // Bold` renders bold on BOTH the header name AND member rows uniformly --
  // `style-cascade-class.ts#resolveClassTagCascadeEntry`'s own doc comment
  // for why this is render-only and carries no DOT-gate width risk (`bold`/
  // `italic` are not `FontSpec` fields the measurer reads at all). Wins
  // over the ancestor `classAttributeFontBold`/`classFontBold` value when
  // set (more specific), matching every OTHER tag-cascade property.
  const tagCascadeEntry = classifier.stereotype !== undefined
    ? resolveClassTagCascadeEntry(theme, resolveStyleStereotypeTags(classifier), classifier.styleGeneration)
    : undefined;
  const attributeFont = {
    family: theme.colors.graph.classAttributeFontFamily ?? fontSpec.family,
    size: theme.colors.graph.classAttributeFontSize ?? fontSpec.size,
    bold: tagCascadeEntry?.fontBold ?? theme.colors.graph.classAttributeFontBold ?? false,
    italic: tagCascadeEntry?.fontItalic ?? theme.colors.graph.classAttributeFontItalic ?? false,
  };
  const headerFont = {
    family: theme.colors.graph.classFontFamily ?? attributeFont.family,
    size: theme.colors.graph.classFontSize ?? attributeFont.size,
    bold: tagCascadeEntry?.fontBold ?? theme.colors.graph.classFontBold ?? attributeFont.bold,
    italic: tagCascadeEntry?.fontItalic ?? theme.colors.graph.classFontItalic ?? attributeFont.italic,
  };
  // G2 N27: `skinparam guillemet <value>` -- both fields undefined means
  // the default `«`/`»` wrapper (`measureGenericClassifier`'s own
  // `guillemet` param default), so this is safe to pass through
  // unconditionally rather than gating on presence.
  const guillemet: GuillemetPair | undefined =
    theme.colors.graph.guillemetStart !== undefined || theme.colors.graph.guillemetEnd !== undefined
      ? { start: theme.colors.graph.guillemetStart ?? '«', end: theme.colors.graph.guillemetEnd ?? '»' }
      : undefined;
  // G2 N38: `skinparam circledCharacterFontSize`/`circledCharacterRadius`
  // -- resolved ONCE here (theme is only available at this level) and
  // threaded through as a plain number, matching `tagCascadeEntry`'s own
  // "resolve once, pass down" precedent above.
  const badgeRadius = resolveBadgeRadius(
    theme.colors.graph.circledCharacterFontSize,
    theme.colors.graph.circledCharacterRadius,
  );
  // G2 N39: `skinparam classStereotypeFontSize`/`FontName`/`FontStyle` --
  // resolved ONCE here (theme is only available at this level), matching
  // `badgeRadius`'s own "resolve once, pass down" precedent above.
  // `italic` has NO `false` fallback -- `FontParam.CLASS_STEREOTYPE`'s own
  // default face IS italic (see `theme.ts#classStereotypeFontSize`'s doc
  // comment), unlike every OTHER class font param.
  const stereoFont = {
    family: theme.colors.graph.classStereotypeFontFamily ?? headerFont.family,
    size: theme.colors.graph.classStereotypeFontSize ?? CLASS_STEREOTYPE_FONT_SIZE,
    bold: theme.colors.graph.classStereotypeFontBold ?? false,
    italic: theme.colors.graph.classStereotypeFontItalic ?? true,
  };
  // G2 N65 item 35: resolved ONCE here (theme is only available at this
  // level), matching `badgeRadius`/`stereoFont`'s own "resolve once, pass
  // down" precedent above -- see `theme.ts#classCascadeMaximumWidth`'s doc
  // comment for the header-vs-member split.
  const headerMaxWidth = theme.colors.graph.classCascadeHeaderMaximumWidth ?? 0;
  const memberMaxWidth = theme.colors.graph.classCascadeMaximumWidth ?? 0;
  return measureGenericClassifier(
    classifier, { header: headerFont, attribute: attributeFont }, measurer, suppress,
    { sprites, guillemet, badgeRadius, stereoFont, strictUml: theme.strictUml === true, headerMaxWidth, memberMaxWidth },
  );
}
