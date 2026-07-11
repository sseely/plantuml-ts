/**
 * `json` classifier sizing — `kind:'json'` leaves in the class diagram layout
 * engine (./layout.ts), mission object-dot-sync Phase L.
 *
 * Faithful port of the dimension math:
 *   @see ~/git/plantuml/.../svek/image/EntityImageJson.java
 *   @see ~/git/plantuml/.../cucadiagram/TextBlockCucaJSon.java
 *   @see ~/git/plantuml/.../cucadiagram/BodierJSon.java
 *
 * The header (name + optional italic stereotype, margin 2,2, stacked) is
 * IDENTICAL to `object`/`map`'s own header formula (EntityImageJson.java's
 * ctor mirrors EntityImageObject/EntityImageMap's line for line) — reused
 * from class-object-map-sizing.ts (`titleDimension`/`measureStereo`/
 * `headerRows`) rather than duplicated a third time.
 *
 * The entries area (`TextBlockCucaJSon`) recurses through the parsed JSON
 * tree: an object member's key AND a scalar value both go through the SAME
 * margin-5,2 text-cell measurement `TextBlockCucaJSon#getTextBlock` uses (the
 * exact same 5,2 margin `TextBlockMap` uses for its own key/value cells —
 * coincidentally equal upstream literals, kept as this file's own named
 * constants rather than imported from class-object-map-sizing.ts, mirroring
 * that file's own MAP_NAME_MARGIN/OBJECT_NAME_PADDING precedent for two
 * independently-defined-but-equal upstream literals); a nested object/array
 * value recurses into its own sub-table instead of a single text cell.
 *
 * RENDERING SIMPLIFICATION (documented divergence, see this task's return):
 * upstream draws one horizontal `hline` per row (top-level AND nested, each
 * scoped to its OWN local column width) plus one vertical `vline` PER TABLE
 * (top-level AND each nested sub-table, at that sub-table's own key-column
 * boundary). `ClassifierGeo` (layout.ts, at the project's 500-line cap) only
 * carries a flat `rows[]`/`dividerYs: number[]` — no per-line x-range — so
 * this port emits every row-boundary Y (top-level AND nested) as a
 * dividerYs entry (drawn FULL WIDTH by the existing renderer, correct only
 * for the true top-level rows) and omits the vertical column divider(s)
 * entirely (no schema room for one, let alone one per nesting level). Text
 * position/size is still exact at every depth — only the divider LINES are
 * simplified. This is "incidental rendering" per this project's own
 * divergence policy, not an information loss: every value is still visible
 * at its correct position.
 */

import type { Classifier, JsonNode } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { ClassifierGeo } from './layout.js';
import type { MeasuredClassifier } from './class-layout-helpers.js';
import { titleDimension, measureStereo, headerRows } from './class-object-map-sizing.js';

interface Dim {
  width: number;
  height: number;
}

/** EntityImageJson: `withMargin(name, 2, 2)` — same numeric value as
 *  MAP_NAME_MARGIN, independently defined (see file doc). */
const JSON_NAME_MARGIN = 2;
/** TextBlockCucaJSon#getTextBlock: `withMargin(result, 5, 2)` — applied to
 *  BOTH a key and a scalar value cell. */
const JSON_CELL_MARGIN_X = 5;
const JSON_CELL_MARGIN_Y = 2;
/** EntityImageJson.xMarginCircle. */
const JSON_X_MARGIN_CIRCLE = 5;
/** BodierLikeClassOrObject#marginEmptyFieldsOrMethod, substituted by
 *  `getMethodOrFieldHeight` when the entries area is empty — UNLIKE `map`,
 *  this DOES fire for `json` (leafType JSON is not excluded, only MAP is). */
const JSON_EMPTY_HEIGHT_FALLBACK = 13;

/** `json Name {}` with no body, or a body that failed to parse (ast.ts's
 *  `Classifier.jsonValue` doc) — measured as an empty object, the closest
 *  stand-in for "no data" that still exercises the real empty-entries path. */
const EMPTY_OBJECT_NODE: JsonNode = { kind: 'object', entries: [] };

// ---------------------------------------------------------------------------
// Recursive dimension measurement (TextBlockCucaJSon#calculateDimension)
// ---------------------------------------------------------------------------

type JsonDimNode =
  | { kind: 'scalar'; text: string; width: number; height: number }
  | { kind: 'array'; items: JsonDimNode[]; width: number; height: number }
  | {
      kind: 'object';
      members: { key: string; keyDim: Dim; value: JsonDimNode }[];
      width1: number;
      width2: number;
      width: number;
      height: number;
    };

/** `getTextBlock`'s shared margin-5,2 cell measurement — used for both a
 *  member's key AND a scalar value (TextBlockCucaJSon#getTextBlock /
 *  #getTextBlockValue's scalar branch). */
function measureJsonCell(text: string, fontSpec: { family: string; size: number }, measurer: StringMeasurer): Dim {
  const m = measurer.measure(text, fontSpec);
  return { width: m.width + JSON_CELL_MARGIN_X * 2, height: m.height + JSON_CELL_MARGIN_Y * 2 };
}

/** `getTextBlockValue`'s scalar display text: a JSON string shows unquoted
 *  (`value.asString()`); every other scalar shows its literal form
 *  (`value.toString()`). */
function scalarText(node: { kind: 'scalar'; value: string | number | boolean | null }): string {
  const v = node.value;
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  return v;
}

function measureScalarNode(
  node: JsonNode & { kind: 'scalar' },
  fontSpec: { family: string; size: number },
  measurer: StringMeasurer,
): JsonDimNode {
  const text = scalarText(node);
  const dim = measureJsonCell(text, fontSpec, measurer);
  return { kind: 'scalar', text, width: dim.width, height: dim.height };
}

/** `TextBlockArray#calculateDimensionSlow`: `mergeTB` per element — width =
 *  max, height = sum (stacked top-to-bottom, no column split). */
function measureArrayNode(
  node: JsonNode & { kind: 'array' },
  fontSpec: { family: string; size: number },
  measurer: StringMeasurer,
): JsonDimNode {
  const items = node.items.map((i) => measureJsonNode(i, fontSpec, measurer));
  const width = items.length === 0 ? 0 : Math.max(...items.map((i) => i.width));
  const height = items.reduce((sum, i) => sum + i.height, 0);
  return { kind: 'array', items, width, height };
}

/** `TextBlockJson#calculateDimensionSlow`: width = width1 (max key cell
 *  width) + width2 (max value cell/sub-table width); height = sum of
 *  per-member `max(keyDim.height, valueDim.height)`. */
function measureObjectNode(
  node: JsonNode & { kind: 'object' },
  fontSpec: { family: string; size: number },
  measurer: StringMeasurer,
): JsonDimNode {
  const members = node.entries.map((e) => ({
    key: e.key,
    keyDim: measureJsonCell(e.key, fontSpec, measurer),
    value: measureJsonNode(e.value, fontSpec, measurer),
  }));
  const width1 = members.length === 0 ? 0 : Math.max(...members.map((m) => m.keyDim.width));
  const width2 = members.length === 0 ? 0 : Math.max(...members.map((m) => m.value.width));
  const height = members.reduce((sum, m) => sum + Math.max(m.keyDim.height, m.value.height), 0);
  return { kind: 'object', members, width1, width2, width: width1 + width2, height };
}

function measureJsonNode(
  node: JsonNode,
  fontSpec: { family: string; size: number },
  measurer: StringMeasurer,
): JsonDimNode {
  if (node.kind === 'scalar') return measureScalarNode(node, fontSpec, measurer);
  if (node.kind === 'array') return measureArrayNode(node, fontSpec, measurer);
  return measureObjectNode(node, fontSpec, measurer);
}

// ---------------------------------------------------------------------------
// Recursive row/divider geometry (TextBlockCucaJSon#drawU)
// ---------------------------------------------------------------------------

interface RowsResult {
  rows: ClassifierGeo['rows'];
  /** Absolute (title-relative-origin) Y of every row-boundary hline this
   *  node's own drawU + its descendants draw — see file doc's rendering
   *  simplification note for why these are all emitted as full-width lines. */
  starts: number[];
}

function buildScalarRows(node: JsonDimNode & { kind: 'scalar' }, x: number, y: number): RowsResult {
  return { rows: [{ text: node.text, y: y + node.height / 2, indent: x + JSON_CELL_MARGIN_X }], starts: [] };
}

/** `TextBlockArray#drawU`: an hline BETWEEN elements only (`if (nb > 0)`) —
 *  the first element has no leading boundary of its own. */
function buildArrayRows(node: JsonDimNode & { kind: 'array' }, x: number, y: number): RowsResult {
  const rows: ClassifierGeo['rows'] = [];
  const starts: number[] = [];
  let curY = y;
  node.items.forEach((item, i) => {
    if (i > 0) starts.push(curY);
    const sub = buildJsonRows(item, x, curY);
    rows.push(...sub.rows);
    starts.push(...sub.starts);
    curY += item.height;
  });
  return { rows, starts };
}

/** `TextBlockJson#drawU`: an hline before EVERY member (including the
 *  first); the value column starts at `x + width1`. */
function buildObjectRows(node: JsonDimNode & { kind: 'object' }, x: number, y: number): RowsResult {
  const rows: ClassifierGeo['rows'] = [];
  const starts: number[] = [];
  let curY = y;
  for (const m of node.members) {
    starts.push(curY);
    const rowHeight = Math.max(m.keyDim.height, m.value.height);
    rows.push({ text: m.key, y: curY + rowHeight / 2, indent: x + JSON_CELL_MARGIN_X });
    const sub = buildJsonRows(m.value, x + node.width1, curY);
    rows.push(...sub.rows);
    starts.push(...sub.starts);
    curY += rowHeight;
  }
  return { rows, starts };
}

function buildJsonRows(node: JsonDimNode, x: number, y: number): RowsResult {
  if (node.kind === 'scalar') return buildScalarRows(node, x, y);
  if (node.kind === 'array') return buildArrayRows(node, x, y);
  return buildObjectRows(node, x, y);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Measure a `json` leaf (EntityImageJson#calculateDimensionSlow). Unlike
 * `object`, there is no `showFields`/suppress parameter — `hide members`/
 * `hide empty members` have no BodierJSon-side effect upstream (matching
 * `map`'s own "showFields is irrelevant" precedent).
 */
export function measureJsonClassifier(
  classifier: Classifier,
  theme: Theme,
  measurer: StringMeasurer,
): MeasuredClassifier {
  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const nameM = measurer.measure(classifier.display, fontSpec);
  const nameDim: Dim = {
    width: nameM.width + JSON_NAME_MARGIN * 2,
    height: nameM.height + JSON_NAME_MARGIN * 2,
  };
  const stereoDim = measureStereo(classifier, theme, measurer);
  const title = titleDimension(nameDim, stereoDim);

  const dimNode = measureJsonNode(classifier.jsonValue ?? EMPTY_OBJECT_NODE, fontSpec, measurer);
  const fieldsHeight = dimNode.height === 0 ? JSON_EMPTY_HEIGHT_FALLBACK : dimNode.height;

  const width = Math.max(dimNode.width, title.width + JSON_X_MARGIN_CIRCLE * 2);
  const height = title.height + fieldsHeight;

  const headerGeo = headerRows(classifier, nameDim.height, stereoDim.height);
  const { rows: entryRows, starts } = buildJsonRows(dimNode, 0, title.height);

  return { width, height, rows: [...headerGeo, ...entryRows], dividerYs: starts };
}
