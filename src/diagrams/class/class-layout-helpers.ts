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
import { hasBadge, BADGE_BOX_HEIGHT, BADGE_BOX_WIDTH, NAME_MARGIN_TOTAL, NAME_LEFT_MARGIN } from './class-badge.js';
import { javaRound4 } from '../../core/number-format.js';

/** SvekEdge.CONSTRAINT_SPOT (SvekEdge.java:122): the fixed side length of the
 *  10x10 label spot emitted for a `constraint on links` edge with no text. */
const CONSTRAINT_SPOT = 10;

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
  }
  if (rel.toMultiplicity !== undefined) {
    const m = measurer.measure(rel.toMultiplicity, font);
    attrs.headLabelWidth = m.width;
    attrs.headLabelHeight = m.height;
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

/** Extra horizontal space reserved for the visibility icon to the left of member text. */
const ICON_WIDTH = 18;

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
  const typeSuffix = member.type !== undefined ? `: ${member.type}` : '';
  if (member.params !== undefined) {
    return `${member.name}(${member.params.join(', ')})${typeSuffix}`;
  }
  return `${member.name}${typeSuffix}`;
}

interface HeaderInfo {
  headerText: string;
  headerItalic: boolean;
}

/** Build the header display string and kind-derived flags for a classifier. */
function computeHeaderInfo(classifier: Classifier): HeaderInfo {
  // Just the name (kind shown via badge + italic) — annotations get an `@` prefix.
  const headerText =
    classifier.kind === 'annotation'
      ? `@${classifier.display}`
      : classifier.display;
  const headerItalic =
    classifier.kind === 'interface' || classifier.kind === 'abstract';
  return { headerText, headerItalic };
}

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
 * N4, jar-verified against `canuti-20-jotu614` (explicit visibility char,
 * icon shown: indent 20 -- an 8px icon-left-inset + 6px icon diameter + 6px
 * text gap = 14px icon zone, ON TOP of a base 6px margin) AND
 * `jobuco-44-zife032`/`bisisi-31-xasa026` (no explicit visibility char, no
 * icon: indent 6 -- base margin only). Gated on `Member.visibilityExplicit`
 * (`class-member-parser.ts`, additive G2 N4 field), matching
 * `class-object-map-sizing.ts`'s existing `hasIcon` gate for object leaves
 * -- an EARLIER iteration's doc comment here (now corrected, see
 * `class-member-ast.ts`) had called the always-reserve behavior a
 * deliberate, pinned divergence; the fresh oracle re-capture shows it was
 * simply unverified, not intentional. Independent of box WIDTH (members
 * are always left-anchored within their own compartment, never centered)
 * -- unlike the header row's centering (see `measureGenericClassifier`'s
 * own doc comment). Box-width RESERVATION (`sectionWidth`, below) still
 * always reserves the icon zone regardless of `visibilityExplicit` --
 * deliberately NOT touched this iteration (a box-WIDTH change is
 * frozen-DOT-adjacent geometry per this mission's own boundary; no
 * evidence yet that jar's width reservation is ALSO conditional).
 */
export const ROW_TEXT_LEFT_MARGIN = 6;
/** Icon zone reserved on a member row with an explicit visibility char. */
const ROW_ICON_ZONE_WIDTH = 14;
const ROW_INDENT_WITH_ICON = ROW_TEXT_LEFT_MARGIN + ROW_ICON_ZONE_WIDTH;

/** One fields-or-methods compartment's total height (margin-only floor when empty). */
function sectionHeight(count: number, memberRowHeight: number): number {
  return count === 0 ? EMPTY_SECTION_HEIGHT : EMPTY_SECTION_HEIGHT + count * memberRowHeight;
}

/**
 * Build the per-member rows for one compartment (fields OR methods), starting
 * at `sectionTop`. `y` is the text BASELINE (G2 N4 -- jar draws plain,
 * un-centered `<text>` for every row, never `dominant-baseline="middle"`;
 * see `renderer.ts#renderRow`'s own doc comment for the render-side half of
 * this fix), `sectionTop + SECTION_MARGIN_TOP + i * memberRowHeight +
 * baselineOffset` where `baselineOffset` is the SAME ascent-from-line-top
 * value {@link measureGenericClassifier} derives for the header row.
 */
function buildSectionRows(
  members: Classifier['members'],
  texts: string[],
  sectionTop: number,
  memberRowHeight: number,
  baselineOffset: number,
  measurer: StringMeasurer,
  fontSpec: { family: string; size: number },
): ClassifierGeo['rows'] {
  const rows: ClassifierGeo['rows'] = [];
  for (let i = 0; i < members.length; i++) {
    const text = texts[i]!;
    const member = members[i]!;
    const showIcon = member.visibilityExplicit === true;
    const y = sectionTop + SECTION_MARGIN_TOP + i * memberRowHeight + baselineOffset;
    rows.push({
      text,
      y,
      indent: showIcon ? ROW_INDENT_WITH_ICON : ROW_TEXT_LEFT_MARGIN,
      width: javaRound4(measurer.measure(text, fontSpec).width),
      ...(showIcon
        ? { visibilityIcon: member.visibility, visibilityIsField: isMethodMember(member) === false }
        : {}),
    });
  }
  return rows;
}

/** Pre-measured classifier dimensions and row/divider layout (no layout coordinates). */
export interface MeasuredClassifier {
  width: number;
  height: number;
  rows: ClassifierGeo['rows'];
  dividerYs: number[];
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

/** Widest single row's reserved width (icon + text), or 0 for an empty section. */
function sectionWidth(texts: string[], measurer: StringMeasurer, fontSpec: { family: string; size: number }): number {
  let widest = 0;
  for (const t of texts) {
    const w = measurer.measure(t, fontSpec).width + ICON_WIDTH;
    if (w > widest) widest = w;
  }
  return texts.length === 0 ? 0 : widest + NAME_MARGIN_TOTAL * 2; // 6px margin each side
}

/**
 * The header row's text position -- G2 N4. `HeaderLayout#drawU`'s
 * `suppWith` term CENTERS the badge+name content block within the full box
 * width whenever member content is wider than the header itself; when the
 * header dominates (`boxWidth === headerWidth`, the common case), the
 * centering term is 0 and this reduces to a plain badge-box-width +
 * left-margin offset -- jar-verified with ZERO residual against
 * `jobuco-44-zife032`/`nubisa-82-tuji339`/`tegoxa-17-kudo421`/
 * `bedogi-86-kala547` (all header-dominated). The wider-box centering case
 * is the CORRECT upstream mechanism (not independently re-derivable from
 * this port's own `headerWidth`, which omits stereotype-line width --
 * `HeaderLayout#getDimension`'s `stereoDim` term this port doesn't model
 * yet -- so it is not pixel-exact on stereotype-bearing fixtures; named,
 * not chased further this iteration).
 */
function buildHeaderRow(
  header: HeaderInfo,
  headerRowHeight: number,
  headerWidth: number,
  boxWidth: number,
  badgeShown: boolean,
  baselineOffset: number,
  fontSize: number,
  headerTextWidth: number,
): ClassifierGeo['rows'][number] {
  const centerOffset = (boxWidth - headerWidth) / 2;
  const indent = centerOffset + (badgeShown ? BADGE_BOX_WIDTH : 0) + NAME_LEFT_MARGIN;
  const y = (headerRowHeight - fontSize) / 2 + baselineOffset;
  return { text: header.headerText, y, indent, italic: header.headerItalic, width: headerTextWidth };
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
  fontSpec: { family: string; size: number },
  measurer: StringMeasurer,
  suppress: MemberSuppression,
): MeasuredClassifier {
  const badgeShown = hasBadge(classifier.kind) && classifier.hideCircle !== true;
  const memberRowHeight = fontSpec.size;
  const header = computeHeaderInfo(classifier);
  // G2 N4: rounded via the SAME Java-%.4f rounding jar's own `SvgGraphics#
  // format` applies before emitting `textLength` -- a raw JS double's
  // shortest round-trip decimal (e.g. `24.150000000000002`) fails an exact
  // string comparison against jar's `"24.15"` even though `compareSvg`'s
  // numeric tolerance would forgive the SAME magnitude of drift on a
  // NUMERIC_ATTRS-listed attribute (`textLength` is not one -- test-harness
  // scope, not touched here; see `core/number-format.ts`'s own doc comment).
  const headerTextWidth = javaRound4(measurer.measure(header.headerText, fontSpec).width);
  const nameWidth = headerTextWidth + NAME_MARGIN_TOTAL;
  const headerRowHeight = Math.max(badgeShown ? BADGE_BOX_HEIGHT : 0, fontSpec.size + 10);
  const headerWidth = (badgeShown ? BADGE_BOX_WIDTH : 0) + nameWidth;
  // G2 N4: ascent-from-line-top -- the SAME baseline offset every text row
  // (header AND members) uses to convert a "line top" position into its SVG
  // `<text y="...">` baseline, mirroring the established `height - descent`
  // pattern (`core/svek/image/EntityImageDescriptionSupport.ts`'s
  // `measureLine`/`lineDescent`, line ~341's `baselineDy = m.height -
  // m.descent`). `getDescent` is content-independent for every measurer in
  // this codebase (that file's own doc comment), so an empty-string probe
  // is equivalent to probing the real header/row text.
  const baselineOffset = fontSpec.size - measurer.getDescent(fontSpec, '');

  // Only include visible (non-hidden) members in layout; split into the two
  // upstream compartments (fields first, then methods — declaration order
  // preserved within each, matching `getFieldsToDisplay`/`getMethodsToDisplay`).
  const visibleMembers = classifier.members.filter((m) => m.hidden !== true);
  const fields = visibleMembers.filter((m) => !isMethodMember(m));
  const methods = visibleMembers.filter(isMethodMember);
  const fieldTexts = fields.map(formatMemberText);
  const methodTexts = methods.map(formatMemberText);

  const memberAreaWidth = Math.max(
    sectionWidth(fieldTexts, measurer, fontSpec),
    sectionWidth(methodTexts, measurer, fontSpec),
  );
  const width = Math.max(headerWidth, memberAreaWidth);
  const headerRow = buildHeaderRow(
    header, headerRowHeight, headerWidth, width, badgeShown, baselineOffset, fontSpec.size, headerTextWidth,
  );

  if (suppress.fields && suppress.methods) {
    return { width, height: headerRowHeight + 4, rows: [headerRow], dividerYs: [] };
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
  const rows: ClassifierGeo['rows'] = [headerRow];
  const dividerYs: number[] = [];
  if (!suppress.fields) {
    dividerYs.push(headerRowHeight);
    rows.push(...buildSectionRows(fields, fieldTexts, headerRowHeight, memberRowHeight, baselineOffset, measurer, fontSpec));
  }
  if (!suppress.methods) {
    dividerYs.push(headerRowHeight + fieldsH);
    rows.push(...buildSectionRows(methods, methodTexts, headerRowHeight + fieldsH, memberRowHeight, baselineOffset, measurer, fontSpec));
  }
  return { width, height, rows, dividerYs };
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
): MeasuredClassifier {
  // object/map/json leaves are NOT the generic name+members box — each has
  // its own upstream-faithful formula (EntityImageObject / EntityImageMap /
  // EntityImageJson + TextBlockMap / TextBlockCucaJSon). Objects have no
  // methods compartment concept (`BodierLikeClassOrObject#getFieldsToDisplay`
  // routes EVERY object member into "fields" regardless of method-like
  // syntax) — only `suppress.fields` is meaningful for them.
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
  return measureGenericClassifier(classifier, fontSpec, measurer, suppress);
}
