/**
 * Classifier sizing/measurement helpers for the class diagram layout engine
 * (src/diagrams/class/layout.ts).
 *
 * Split out of layout.ts purely to keep every function under the project's
 * per-function complexity/size caps (CCN <= 10, <= 30 NLOC) and the file
 * under the 500-line cap. No behavior differs from the original inline code
 * — this is a pure move.
 *
 * No DOM, no SVG. All I/O is plain data.
 */

import type { Classifier } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { ClassifierGeo } from './layout.js';

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

/** Format a member text string for object diagram instances (field = value). */
function formatObjectMemberText(member: { name: string; type?: string }): string {
  return member.type !== undefined ? `${member.name} = ${member.type}` : member.name;
}

/**
 * Measure the widest of the header text and all member texts. Class/
 * interface/enum member texts get ICON_WIDTH added for the visibility icon;
 * object member texts (isObject) do not.
 */
function computeLongestTextWidth(
  headerText: string,
  memberTexts: string[],
  isObject: boolean,
  measurer: StringMeasurer,
  fontSpec: { family: string; size: number },
): number {
  const allTexts = [headerText, ...memberTexts];
  let longestWidth = 0;
  for (let i = 0; i < allTexts.length; i++) {
    const measured = measurer.measure(allTexts[i]!, fontSpec);
    const w = measured.width + (i > 0 && !isObject ? ICON_WIDTH : 0);
    if (w > longestWidth) longestWidth = w;
  }
  return longestWidth;
}

interface MemberRowsParams {
  visibleMembers: Classifier['members'];
  memberTexts: string[];
  isObject: boolean;
  headerRowHeight: number;
  memberTopPad: number;
  memberRowHeight: number;
}

/** Build the per-member rows (excludes the header row). */
function buildMemberRows(params: MemberRowsParams): ClassifierGeo['rows'] {
  const { visibleMembers, memberTexts, isObject, headerRowHeight, memberTopPad, memberRowHeight } = params;
  const rows: ClassifierGeo['rows'] = [];
  for (let i = 0; i < visibleMembers.length; i++) {
    const memberText = memberTexts[i]!;
    const y = headerRowHeight + memberTopPad + i * memberRowHeight + memberRowHeight / 2;
    if (isObject) {
      rows.push({ text: memberText, y, indent: 4 });
    } else {
      rows.push({ text: memberText, y, indent: ICON_WIDTH + 4, visibilityIcon: visibleMembers[i]!.visibility });
    }
  }
  return rows;
}

interface HeaderInfo {
  headerText: string;
  headerItalic: boolean;
  isObject: boolean;
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
  const isObject = classifier.kind === 'object';
  return { headerText, headerItalic, isObject };
}

interface RowMetrics {
  headerRowHeight: number;
  memberTopPad: number;
  memberRowHeight: number;
}

/** Height: if the member section is suppressed, omit the member area entirely. */
function computeClassifierHeight(
  suppressMemberSection: boolean,
  visibleMemberCount: number,
  metrics: RowMetrics,
): number {
  const { headerRowHeight, memberTopPad, memberRowHeight } = metrics;
  return suppressMemberSection
    ? headerRowHeight + 4  // header + bottom padding only
    : headerRowHeight +
      (visibleMemberCount > 0 ? memberTopPad : 0) +
      visibleMemberCount * memberRowHeight +
      4; // bottom padding
}

/**
 * Build rows: header first, then visible members (unless section suppressed).
 * A class with no members still shows the header row by default.
 */
function buildClassifierRows(
  header: HeaderInfo,
  visibleMembers: Classifier['members'],
  memberTexts: string[],
  suppressMemberSection: boolean,
  metrics: RowMetrics,
): ClassifierGeo['rows'] {
  const { headerRowHeight, memberTopPad, memberRowHeight } = metrics;
  const rows: ClassifierGeo['rows'] = [
    { text: header.headerText, y: headerRowHeight / 2, indent: 0, italic: header.headerItalic },
  ];
  if (suppressMemberSection) return rows;
  const memberRowsParams = { visibleMembers, memberTexts, isObject: header.isObject, headerRowHeight, memberTopPad, memberRowHeight };
  rows.push(...buildMemberRows(memberRowsParams));
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
  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const metrics: RowMetrics = { headerRowHeight: theme.fontSize * 1.4 + 8, memberTopPad: 4, memberRowHeight: theme.fontSize * 1.4 };
  const header = computeHeaderInfo(classifier);
  // Only include visible (non-hidden) members in layout.
  const visibleMembers = classifier.members.filter((m) => m.hidden !== true);
  const memberTexts = visibleMembers.map(header.isObject ? formatObjectMemberText : formatMemberText);
  const longestWidth = computeLongestTextWidth(header.headerText, memberTexts, header.isObject, measurer, fontSpec);
  const width = Math.max(100, longestWidth + 20);
  const height = computeClassifierHeight(suppressMemberSection, visibleMembers.length, metrics);
  const rows = buildClassifierRows(header, visibleMembers, memberTexts, suppressMemberSection, metrics);
  // dividerYs: one after the header row, unless suppressed by a hide directive.
  const dividerYs: number[] = suppressMemberSection ? [] : [metrics.headerRowHeight];
  return { width, height, rows, dividerYs };
}
