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
import {
  hasBadge,
  BADGE_BOX_HEIGHT,
  BADGE_BOX_WIDTH,
  BADGE_LEFT_MARGIN,
  BADGE_RADIUS,
  NAME_MARGIN_TOTAL,
  NAME_LEFT_MARGIN,
} from './class-badge.js';
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

/** Pre-measured classifier dimensions and row/divider layout (no layout coordinates). */
export interface MeasuredClassifier {
  width: number;
  height: number;
  rows: ClassifierGeo['rows'];
  dividerYs: number[];
}

/**
 * The header row's badge + text x-positions -- G2 N23, replacing N4's
 * symmetric `centerOffset` guess. `HeaderLayout#drawU` (`~/git/plantuml/
 * .../svek/HeaderLayout.java:81-117`) does NOT split the wider-box slack
 * evenly between badge and name: it reserves `h2 = min(circleDim.width / 4,
 * suppWith * 0.1)` of the slack as an asymmetric "extra" term shared by
 * BOTH sides, then splits the REMAINDER `h1 = (suppWith - h2) / 2` evenly --
 * the badge moves right by `h1` alone, while the name block moves right by
 * `h1 + h2` (i.e. `centerOffset + h2/2`, `h2/2` MORE than the naive
 * symmetric guess) and the badge moves right by `h1` alone (`centerOffset -
 * h2/2`, `h2/2` LESS). `suppWith = max(0, boxWidth - headerWidth)` reduces
 * to `2 * centerOffset` in this port's no-stereotype-modeled approximation
 * (`stereoDim`/`genericDim` both 0 -- `HeaderLayout#getDimension`'s
 * `stereoDim` term is still not ported, named since N21/N22; the formula
 * below is exact for every stereotype-free fixture, which is every target
 * fixture this iteration verified against).
 *
 * Jar-verified BYTE-EXACT (not just direction) on 3 independent fixtures
 * sharing this exact header (`sufide-66-sanu583`/`xajefo-97-julu315`/
 * `cokeje-99-gede231`, `plans/g2-class-svg/ledger.md` N23): `h2` hits its
 * `circleDim.width / 4 = BADGE_BOX_WIDTH / 4 = 6.5` cap on all 3, so the
 * badge-vs-text divergence from the OLD symmetric formula is a UNIFORM
 * 6.5/2 = 3.25px in opposite directions -- exactly N21's own "badge too far
 * right, text too far left, uniform 3.25px" finding.
 *
 * When `boxWidth === headerWidth` (the common, header-dominated case),
 * `suppWith = 0` so `h1 = h2 = 0` -- reduces to the OLD formula exactly,
 * zero regression risk for the majority (non-member-widened) case already
 * jar-verified since N4.
 */
function buildHeaderRow(
  header: HeaderInfo,
  headerRowHeight: number,
  headerWidth: number,
  boxWidth: number,
  badgeShown: boolean,
  baselineOffset: number,
  fontSpec: { family: string; size: number },
  headerTextWidth: number,
): ClassifierGeo['rows'][number] {
  const badgeBoxWidth = badgeShown ? BADGE_BOX_WIDTH : 0;
  const suppWith = Math.max(0, boxWidth - headerWidth);
  const h2 = Math.min(badgeBoxWidth / 4, suppWith * 0.1);
  const h1 = (suppWith - h2) / 2;
  const indent = badgeBoxWidth + h1 + h2 + NAME_LEFT_MARGIN;
  const badgeIndent = h1 + BADGE_LEFT_MARGIN + BADGE_RADIUS;
  const y = (headerRowHeight - fontSpec.size) / 2 + baselineOffset;
  return {
    text: header.headerText,
    y,
    indent,
    italic: header.headerItalic,
    width: headerTextWidth,
    badgeIndent,
    fontFamily: fontSpec.family,
    fontSize: fontSpec.size,
  };
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
  sprites: SpriteRegistry | undefined,
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

  const memberAreaWidth = Math.max(
    sectionWidth(fieldRowBuilds, fieldsHasIcon),
    sectionWidth(methodRowBuilds, methodsHasIcon),
  );
  const width = Math.max(headerWidth, memberAreaWidth);
  const headerRow = buildHeaderRow(
    header, headerRowHeight, headerWidth, width, badgeShown, baselineOffset, fontSpec, headerTextWidth,
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
  const rowCtx: SectionRowContext = { memberRowHeight, baselineOffset };
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
  // G2 N23: `skinparam class { AttributeFontSize/AttributeFontName }`
  // (`FontParam.CLASS_ATTRIBUTE`) overrides the WHOLE generic classifier box
  // -- header name text AND member rows both -- jar-verified `jisanu-32-
  // gado231`: header "FontSizeIssue" AND every member row render at the
  // SAME overridden `font-size="16" font-family="Courier"`, not just the
  // member compartment its name would suggest. Scoped to the generic
  // name+members box only (usecase/actor/lollipop above use their own
  // unrelated upstream FontParams, unaffected).
  const classFontSpec = {
    family: theme.colors.graph.classAttributeFontFamily ?? fontSpec.family,
    size: theme.colors.graph.classAttributeFontSize ?? fontSpec.size,
  };
  return measureGenericClassifier(classifier, classFontSpec, measurer, suppress, sprites);
}
