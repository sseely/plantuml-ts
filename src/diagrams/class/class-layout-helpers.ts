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
import { hasBadge, BADGE_BOX_HEIGHT, BADGE_BOX_WIDTH, NAME_MARGIN_TOTAL } from './class-badge.js';

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

/** Format a member text string for class/interface/enum members (no visibility prefix). */
export function formatMemberText(member: {
  visibility: string;
  name: string;
  type?: string;
  params?: string[];
}): string {
  if (member.params !== undefined) {
    return `${member.name}(${member.params.join(', ')}): ${member.type ?? ''}`;
  }
  return `${member.name}: ${member.type ?? ''}`;
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
 * content on top of the same 8px margin envelope (rowHeight itself is the
 * pre-existing, unverified-this-iteration `fontSize * 1.4` estimate —
 * unchanged from before this fix, since no target fixture this iteration
 * has visible members to verify against).
 */
const EMPTY_SECTION_HEIGHT = 8;
const SECTION_MARGIN_TOP = 4;

/** One fields-or-methods compartment's total height (margin-only floor when empty). */
function sectionHeight(count: number, memberRowHeight: number): number {
  return count === 0 ? EMPTY_SECTION_HEIGHT : EMPTY_SECTION_HEIGHT + count * memberRowHeight;
}

/** Build the per-member rows for one compartment (fields OR methods), starting at `sectionTop`. */
function buildSectionRows(
  members: Classifier['members'],
  texts: string[],
  sectionTop: number,
  memberRowHeight: number,
): ClassifierGeo['rows'] {
  const rows: ClassifierGeo['rows'] = [];
  for (let i = 0; i < members.length; i++) {
    const y = sectionTop + SECTION_MARGIN_TOP + i * memberRowHeight + memberRowHeight / 2;
    rows.push({ text: texts[i]!, y, indent: ICON_WIDTH + 4, visibilityIcon: members[i]!.visibility });
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
 * decides method-vs-field at parse time, so no text re-scan is needed here.
 */
function isMethodMember(m: Classifier['members'][number]): boolean {
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
  suppressMemberSection: boolean,
): MeasuredClassifier {
  const badgeShown = hasBadge(classifier.kind) && classifier.hideCircle !== true;
  const memberRowHeight = fontSpec.size * 1.4;
  const header = computeHeaderInfo(classifier);
  const nameWidth = measurer.measure(header.headerText, fontSpec).width + NAME_MARGIN_TOTAL;
  const headerRowHeight = Math.max(badgeShown ? BADGE_BOX_HEIGHT : 0, fontSpec.size + 10);
  const headerWidth = (badgeShown ? BADGE_BOX_WIDTH : 0) + nameWidth;

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

  if (suppressMemberSection) {
    const rows: ClassifierGeo['rows'] = [
      { text: header.headerText, y: headerRowHeight / 2, indent: 0, italic: header.headerItalic },
    ];
    return { width, height: headerRowHeight + 4, rows, dividerYs: [] };
  }

  const fieldsH = sectionHeight(fields.length, memberRowHeight);
  const methodsH = sectionHeight(methods.length, memberRowHeight);
  const height = headerRowHeight + fieldsH + methodsH;
  const rows: ClassifierGeo['rows'] = [
    { text: header.headerText, y: headerRowHeight / 2, indent: 0, italic: header.headerItalic },
    ...buildSectionRows(fields, fieldTexts, headerRowHeight, memberRowHeight),
    ...buildSectionRows(methods, methodTexts, headerRowHeight + fieldsH, memberRowHeight),
  ];
  // Both compartment dividers are always drawn when the member section is
  // shown — even when one (or both) is empty (see `EMPTY_SECTION_HEIGHT`'s
  // doc comment above).
  const dividerYs: number[] = [headerRowHeight, headerRowHeight + fieldsH];
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
 * Compute the pre-measured dimensions and row/divider layout for a classifier.
 * Members with hidden=true are excluded from height calculations and row output.
 *
 * @param suppressMemberSection - When true the member section (divider + rows) is
 *   omitted entirely regardless of member count. This is set when a hide directive
 *   actively suppresses the member area for this classifier (hide members, or
 *   hide empty members when the classifier has no visible members).
 */
export function measureClassifier(
  classifier: Classifier,
  theme: Theme,
  measurer: StringMeasurer,
  suppressMemberSection: boolean,
): MeasuredClassifier {
  // object/map/json leaves are NOT the generic name+members box — each has
  // its own upstream-faithful formula (EntityImageObject / EntityImageMap /
  // EntityImageJson + TextBlockMap / TextBlockCucaJSon).
  if (classifier.kind === 'object') {
    return measureObjectClassifier(classifier, theme, measurer, suppressMemberSection);
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
  return measureGenericClassifier(classifier, fontSpec, measurer, suppressMemberSection);
}
