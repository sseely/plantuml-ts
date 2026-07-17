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
// Reused from the description engine (no cycle: description/ never imports
// class/) — `usecase`/`mix_actor` leaves under allowmixing use the SAME
// USymbol sizing formulas as their standalone descdiagram counterparts.
import { measureActor, measureUsecase } from '../description/leaf-sizing.js';
import { measureObjectClassifier, measureMapClassifier } from './class-object-map-sizing.js';
import { measureJsonClassifier } from './class-json-sizing.js';
import { isCollapsedGroup } from './class-magma.js';
import {
  measureEmptyPackageLeafDim,
  type EmptyPackageLeafDim,
} from './class-namespace-shape.js';
import {
  hasBadge,
  BADGE_BOX_HEIGHT,
  BADGE_BOX_WIDTH,
  NAME_MARGIN_TOTAL,
  computeHeaderSlack,
} from './class-badge.js';
import {
  splitStereotypeLabels,
  measureStereoLabelWidths,
  stereoBlockDim,
  buildStereoRows,
  buildHeaderRow,
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
import { buildMemberRow, type MemberRowBuild } from './class-member-creole.js';
import {
  ROW_TEXT_LEFT_MARGIN,
  isMethodMember,
  sectionHeight,
  buildSectionRows,
  sectionWidth,
  type SectionRowContext,
} from './class-member-rows.js';
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

/**
 * Edge label attributes from a relationship's label + multiplicities. The Svek
 * comparator counts edges carrying each label kind (labelOk), so a relationship
 * label emits `label`, the from-side multiplicity emits `taillabel`, and the
 * to-side multiplicity emits `headlabel` (widths/heights are measured but
 * tolerant). The emitter needs only the sizes for tail/head — no text field.
 */
export function edgeLabelAttrs(
  rel: Relationship,
  font: { family: string; size: number },
  measurer: StringMeasurer,
): NonNullable<DotInputEdge['attributes']> {
  const attrs: NonNullable<DotInputEdge['attributes']> = {};
  if (rel.label !== undefined) {
    const m = measurer.measure(rel.label, font);
    attrs.label = rel.label;
    attrs.labelWidth = m.width;
    attrs.labelHeight = m.height;
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
  // bare 6th positional param isn't available.
  options: { sprites: SpriteRegistry | undefined; guillemet?: GuillemetPair | undefined },
): MeasuredClassifier {
  const { sprites, guillemet } = options;
  // G2 N32: `fontSpec` (unchanged name -- the pre-existing "generic"
  // classifier font) is now specifically the ATTRIBUTE/member-row font;
  // `headerFont` is the classifier HEADER's own, independently-overridable
  // font -- see `theme.ts#classFontSize`'s doc comment for the jar-verified
  // cascade (`measureClassifier` below builds both, header falling back to
  // attribute, matching `FromSkinparamToStyle.java:185-191`'s style-selector
  // specificity: `element.class.header` cascades from `element.class` when
  // it carries no override of its own).
  const { header: headerFont, attribute: fontSpec } = fonts;
  const badgeShown = hasBadge(classifier.kind) && classifier.hideCircle !== true;
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
  const headerTextWidth = javaRound4(measurer.measure(header.headerText, headerFont).width);
  const nameWidth = headerTextWidth + NAME_MARGIN_TOTAL;
  // G2 N24: `HeaderLayout#getDimension`'s `stereoDim` term -- a classifier's
  // `<<stereotype>>` (possibly STACKED, `<<A>><<B>>`) draws as its own text
  // row(s) above the header name and can widen/heighten the header box.
  // Formula + jar evidence: `class-stereotype.ts`'s own doc comment.
  // G2 N24: `visibleStereotypeLabels` is pre-filtered by
  // `class-directives.ts#applyStereotypeHideShow` (`hide|show [<<pattern>>]
  // stereotype(s)`) -- fall back to an unfiltered split only for hand-built
  // test geometries that bypass that post-parse pass.
  const stereoLabels = classifier.visibleStereotypeLabels
    ?? (classifier.stereotype !== undefined ? splitStereotypeLabels(classifier.stereotype) : []);
  const stereoLabelWidths = measureStereoLabelWidths(stereoLabels, headerFont.family, measurer, guillemet);
  const blockDim = stereoBlockDim(stereoLabelWidths);
  const circleWidth = badgeShown ? BADGE_BOX_WIDTH : 0;
  const widthStereoAndName = Math.max(blockDim.width, nameWidth);
  // G2 N32: `class Foo<T>`'s generic type-parameter tag box -- widens/
  // heightens the header exactly like the stereotype block above (SAME
  // `HeaderLayout#getDimension` width-sum/height-max shape), see
  // `class-stereotype.ts`'s own "generic type-parameter TAG box" section
  // doc comment for the full jar derivation + DOT-gate verification.
  const genericDim = measureGenericTagDim(classifier.typeParams ?? [], headerFont.family, measurer);
  const headerRowHeight = Math.max(
    badgeShown ? BADGE_BOX_HEIGHT : 0, blockDim.height + headerFont.size + 10, genericDim?.height ?? 0,
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
  const stereoBaselineOffset = CLASS_STEREOTYPE_FONT_SIZE -
    measurer.getDescent({ family: headerFont.family, size: CLASS_STEREOTYPE_FONT_SIZE }, '');

  // Only include visible (non-hidden) members in layout; split into the two
  // upstream compartments (fields first, then methods — declaration order
  // preserved within each, matching `getFieldsToDisplay`/`getMethodsToDisplay`).
  const visibleMembers = classifier.members.filter((m) => m.hidden !== true);
  const fields = visibleMembers.filter((m) => !isMethodMember(m));
  const methods = visibleMembers.filter(isMethodMember);
  const fieldTexts = fields.map(formatMemberText);
  const methodTexts = methods.map(formatMemberText);
  // G2 N22: each member's creole build (classify + atoms + measured width)
  // is computed ONCE here and reused for BOTH the section max-width scan
  // (`sectionWidth`) and the stored row (`buildSectionRows`) -- avoids
  // building/measuring the SAME row's atoms twice, and guarantees the
  // rendered atoms are EXACTLY the ones the width formula summed.
  const fieldRowBuilds: MemberRowBuild[] = fields.map((m, i) =>
    buildMemberRow(fieldTexts[i]!, m, fontSpec, measurer, sprites),
  );
  const methodRowBuilds: MemberRowBuild[] = methods.map((m, i) =>
    buildMemberRow(methodTexts[i]!, m, fontSpec, measurer, sprites),
  );
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
  const memberAreaWidth = Math.max(
    suppress.fields ? 0 : sectionWidth(fieldRowBuilds, fieldsHasIcon),
    suppress.methods ? 0 : sectionWidth(methodRowBuilds, methodsHasIcon),
  );
  const width = Math.max(headerWidth, memberAreaWidth);
  // G2 N32: positioned against the FINAL box `width` (post member-content
  // max), matching `HeaderLayout#drawU`'s own `width` parameter -- see
  // `class-stereotype.ts#buildGenericTagGeo`'s doc comment for why this is
  // NOT `headerWidth` alone.
  const genericTagGeo = genericDim !== undefined
    ? buildGenericTagGeo(classifier.typeParams ?? [], genericDim, width, headerFont.family, stereoBaselineOffset)
    : undefined;
  const genericTagField = genericTagGeo !== undefined ? { genericTag: genericTagGeo } : {};
  const { h1, h2 } = computeHeaderSlack(width, headerWidth, circleWidth);
  const { rows: stereoRows, nameTop } = buildStereoRows({
    labels: stereoLabels,
    labelWidths: stereoLabelWidths,
    fontFamily: headerFont.family,
    circleWidth,
    widthStereoAndName,
    blockDim,
    h1,
    h2,
    headerRowHeight,
    nameLineHeight: headerFont.size,
    stereoBaselineOffset,
    guillemet,
  });
  const headerRow = buildHeaderRow({
    header, circleWidth, widthStereoAndName, nameWidth, h1, h2, nameTop,
    baselineOffset: headerBaselineOffset, fontSpec: headerFont, headerTextWidth,
  });
  const headerRowCountField = stereoRows.length > 0 ? { headerRowCount: 1 + stereoRows.length } : {};

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
      width, height: headerRowHeight, rows: [...stereoRows, headerRow], dividerYs: [],
      ...headerRowCountField, ...badgeCharField, ...badgeColorField, ...genericTagField,
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
  const fieldsH = suppress.fields ? 0 : sectionHeight(fields.length, memberRowHeight);
  const methodsH = suppress.methods ? 0 : sectionHeight(methods.length, memberRowHeight);
  const height = headerRowHeight + fieldsH + methodsH;
  const rows: ClassifierGeo['rows'] = [...stereoRows, headerRow];
  const dividerYs: number[] = [];
  const rowCtx: SectionRowContext = { memberRowHeight, baselineOffset: memberBaselineOffset };
  if (!suppress.fields) {
    dividerYs.push(headerRowHeight);
    rows.push(...buildSectionRows(fields, fieldTexts, fieldRowBuilds, headerRowHeight, fieldsHasIcon, rowCtx));
  }
  if (!suppress.methods) {
    dividerYs.push(headerRowHeight + fieldsH);
    rows.push(
      ...buildSectionRows(methods, methodTexts, methodRowBuilds, headerRowHeight + fieldsH, methodsHasIcon, rowCtx),
    );
  }
  return {
    width, height, rows, dividerYs,
    ...headerRowCountField, ...badgeCharField, ...badgeColorField, ...genericTagField,
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
  const attributeFont = {
    family: theme.colors.graph.classAttributeFontFamily ?? fontSpec.family,
    size: theme.colors.graph.classAttributeFontSize ?? fontSpec.size,
    bold: theme.colors.graph.classAttributeFontBold ?? false,
    italic: theme.colors.graph.classAttributeFontItalic ?? false,
  };
  const headerFont = {
    family: theme.colors.graph.classFontFamily ?? attributeFont.family,
    size: theme.colors.graph.classFontSize ?? attributeFont.size,
    bold: theme.colors.graph.classFontBold ?? attributeFont.bold,
    italic: theme.colors.graph.classFontItalic ?? attributeFont.italic,
  };
  // G2 N27: `skinparam guillemet <value>` -- both fields undefined means
  // the default `«`/`»` wrapper (`measureGenericClassifier`'s own
  // `guillemet` param default), so this is safe to pass through
  // unconditionally rather than gating on presence.
  const guillemet: GuillemetPair | undefined =
    theme.colors.graph.guillemetStart !== undefined || theme.colors.graph.guillemetEnd !== undefined
      ? { start: theme.colors.graph.guillemetStart ?? '«', end: theme.colors.graph.guillemetEnd ?? '»' }
      : undefined;
  return measureGenericClassifier(
    classifier, { header: headerFont, attribute: attributeFont }, measurer, suppress, { sprites, guillemet },
  );
}
