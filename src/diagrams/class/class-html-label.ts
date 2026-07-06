/**
 * Class-diagram HTML compartment-label builder.
 *
 * Builds the DOT `label=<<TABLE>...>` HTML-table string for a class svek node
 * rendered as `shape=plaintext`, mirroring upstream EntityImageClass's
 * compartment structure (svek/image/EntityImageClass.java +
 * EntityImageClassHeader): (1) name + optional `«stereotype»`, (2)
 * attributes, (3) operations — one compartment `<TR>` per section, present
 * only when it has content.
 *
 * Per ADR-2 (planning/mission-a2-class/decisions.md): the DOT-parity
 * comparator never reads inside `label=<...>`, so exact internal pixels are
 * tolerant — but the FULL table (not a placeholder) is built here to
 * future-proof the eventual SVG-from-DOT render gate.
 *
 * A BARE classifier (no visible members, no stereotype) returns `null` — the
 * caller (src/diagrams/class/layout.ts, T4) falls back to `shape=rect`.
 */

import type { Classifier, ClassifierKind, Member } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import { formatMemberText } from './layout.js';

// ---------------------------------------------------------------------------
// Sizing constants — mirror layout.ts's measureClassifier formulas so the
// HTML-label geometry stays visually consistent with the plain-geometry
// renderer, without importing its private layout state.
// ---------------------------------------------------------------------------

/** Extra horizontal space reserved for the visibility-symbol column (mirrors layout.ts ICON_WIDTH). */
const ICON_WIDTH = 18;
const MIN_WIDTH = 100;
const WIDTH_PADDING = 20;
const CELL_PADDING = 4;

export interface ClassHtmlLabel {
  label: string;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// HTML escaping — graphviz HTML-like labels use the same XML-entity rules as
// SVG text content (member types/generics such as `Map<K, V>` must be
// escaped). Kept local per svg.ts / latex.ts precedent (each file owns its
// own small escaper rather than sharing one across module boundaries).
// Uses split/join rather than a `/[<>]/`-style regex — a regex literal
// containing bare `<`/`>` trips the complexity linter's TS tokenizer.
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}

const round = (n: number): string => String(Math.round(n));

/** Number of text-content lines a compartment occupies, plus top/bottom cell padding. */
function compartmentHeight(lineCount: number, lineHeight: number): number {
  return lineCount * lineHeight + 2 * CELL_PADDING;
}

/** Header display text: annotations get an `@` prefix (mirrors layout.ts). */
function headerText(classifier: Classifier): string {
  return classifier.kind === 'annotation'
    ? `@${classifier.display}`
    : classifier.display;
}

function isItalicKind(kind: ClassifierKind): boolean {
  return kind === 'interface' || kind === 'abstract';
}

/** One member's rendered line: visibility symbol + formatted text, with
 *  `<U>`/`<I>` style wrapping for static/abstract members (object-diagram
 *  instances have no visibility concept, matching layout.ts's isObject branch). */
function memberLine(member: Member, isObject: boolean): string {
  const escaped = escapeHtml(memberPlainText(member, isObject));
  const withVisibility = isObject ? escaped : `${escapeHtml(member.visibility)} ${escaped}`;
  const abstractWrapped = member.isAbstract ? `<I>${withVisibility}</I>` : withVisibility;
  return member.isStatic ? `<U>${abstractWrapped}</U>` : abstractWrapped;
}

/** Plain (unwrapped, unescaped) text for a member — shared by width measurement and rendering. */
function memberPlainText(member: Member, isObject: boolean): string {
  return isObject
    ? (member.type !== undefined ? `${member.name} = ${member.type}` : member.name)
    : formatMemberText(member);
}

/** Widest of header, stereotype, and every member line (+ ICON_WIDTH reserve
 *  for the visibility column on non-object members, mirroring layout.ts's
 *  measureClassifier). */
function measureWidth(
  classifier: Classifier,
  theme: Theme,
  measurer: StringMeasurer,
  members: Member[],
  isObject: boolean,
): number {
  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  let longest = measurer.measure(headerText(classifier), fontSpec).width;
  if (classifier.stereotype !== undefined) {
    const w = measurer.measure(`«${classifier.stereotype}»`, fontSpec).width;
    if (w > longest) longest = w;
  }
  for (const m of members) {
    const w = measurer.measure(memberPlainText(m, isObject), fontSpec).width + (isObject ? 0 : ICON_WIDTH);
    if (w > longest) longest = w;
  }
  return Math.max(MIN_WIDTH, longest + WIDTH_PADDING);
}

/** Total height: one compartment block per non-empty section. */
function measureHeight(
  classifier: Classifier,
  lineHeight: number,
  attributeMembers: Member[],
  operationMembers: Member[],
): number {
  const nameLines = 1 + (classifier.stereotype !== undefined ? 1 : 0);
  let height = compartmentHeight(nameLines, lineHeight);
  if (attributeMembers.length > 0) {
    height += compartmentHeight(attributeMembers.length, lineHeight);
  }
  if (operationMembers.length > 0) {
    height += compartmentHeight(operationMembers.length, lineHeight);
  }
  return height;
}

/** One compartment `<TR>`: all its member lines joined into a single left-aligned cell. */
function compartmentRow(members: Member[], isObject: boolean): string {
  const content = members.map((m) => memberLine(m, isObject)).join('<BR ALIGN="LEFT"/>');
  return `<TR><TD ALIGN="LEFT">${content}</TD></TR>`;
}

/** All compartment `<TR>` groups: name (+ optional stereotype), attributes, operations. */
function buildCompartmentRows(
  classifier: Classifier,
  attributeMembers: Member[],
  operationMembers: Member[],
  isObject: boolean,
): string[] {
  const name = headerText(classifier);
  const nameCellLines = [isItalicKind(classifier.kind) ? `<I>${escapeHtml(name)}</I>` : escapeHtml(name)];
  if (classifier.stereotype !== undefined) {
    nameCellLines.push(`«${escapeHtml(classifier.stereotype)}»`);
  }

  const rows: string[] = [`<TR><TD>${nameCellLines.join('<BR/>')}</TD></TR>`];
  if (attributeMembers.length > 0) rows.push(compartmentRow(attributeMembers, isObject));
  if (operationMembers.length > 0) rows.push(compartmentRow(operationMembers, isObject));
  return rows;
}

/**
 * Build the DOT HTML-table label + overall dimensions for a class svek node.
 *
 * Returns `null` for a bare classifier (no visible members, no stereotype) —
 * the caller must emit `shape=rect` instead of consuming this result.
 */
export function buildClassHtmlLabel(
  classifier: Classifier,
  theme: Theme,
  measurer: StringMeasurer,
): ClassHtmlLabel | null {
  const visibleMembers = classifier.members.filter((m) => m.hidden !== true);
  if (visibleMembers.length === 0 && classifier.stereotype === undefined) {
    return null;
  }

  const isObject = classifier.kind === 'object';
  const attributeMembers = visibleMembers.filter((m) => m.params === undefined);
  const operationMembers = visibleMembers.filter((m) => m.params !== undefined);
  const lineHeight = theme.fontSize * 1.4;

  const width = measureWidth(classifier, theme, measurer, [...attributeMembers, ...operationMembers], isObject);
  const height = measureHeight(classifier, lineHeight, attributeMembers, operationMembers);
  const rows = buildCompartmentRows(classifier, attributeMembers, operationMembers, isObject);

  const label =
    `<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="${CELL_PADDING}" ` +
    `FIXEDSIZE="TRUE" WIDTH="${round(width)}" HEIGHT="${round(height)}" PORT="h">` +
    rows.join('') +
    '</TABLE>>';

  return { label, width, height };
}
