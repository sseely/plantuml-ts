/**
 * `json` state sizing — `kind:'json'` leaves in the state diagram layout
 * engine (./state-sizing.ts). Mission A4 Phase L iteration 20
 * (maruju-55-soko478, embedded `json foo1 { ... }` in a state diagram).
 *
 * Faithful port of the dimension math, MIRRORING the class engine's own
 * verified port (`class-json-sizing.ts`) rather than importing across
 * engines (D1 precedent — two engines sharing an upstream grammar/formula
 * each keep their own copy):
 *   @see ~/git/plantuml/.../svek/image/EntityImageJson.java
 *   @see ~/git/plantuml/.../cucadiagram/TextBlockCucaJSon.java
 *   @see ~/git/plantuml/.../cucadiagram/BodierJSon.java
 *   @see src/diagrams/class/class-json-sizing.ts (the class engine's own copy)
 *
 * Only the DIMENSION formula is ported here — unlike the class engine, the
 * state diagram layout model (`StateNodeGeo`, ./state-geo-types.ts) has no
 * per-node "rows"/divider geometry at all (not even for a plain `state Foo`
 * leaf's own description/body lines — renderer.ts's `renderNormal` only ever
 * draws the name). Detailed JSON-table SVG content (member rows, column
 * dividers) is therefore deferred to future visual-fidelity work, the same
 * documented gap renderer.ts's `syncBar` case already carries for fork/join
 * bars ("no dedicated renderer yet — T3/T4 owns renderer.ts's real
 * rewrite"). This module only has to produce the correct DOT node WIDTH/
 * HEIGHT (svek's `shape=plaintext` sizing box) — this mission's dot-sync
 * gate compares shape + structural graph properties, not per-node pixel
 * size (scripts/dot-sync-drilldown.ts's CHECKS list has no sizeOk entry).
 */

import type { State } from './ast.js';
import type { JsonNode } from './state-json-ast.js';
import type { Theme } from '../../core/theme.js';
import type { FontSpec, StringMeasurer } from '../../core/measurer.js';

interface Dim {
  width: number;
  height: number;
}

/** EntityImageJson: `withMargin(name, 2, 2)`. */
const JSON_NAME_MARGIN = 2;
/** TextBlockCucaJSon#getTextBlock: `withMargin(result, 5, 2)` — applied to
 *  BOTH a key and a scalar value cell. */
const JSON_CELL_MARGIN_X = 5;
const JSON_CELL_MARGIN_Y = 2;
/** EntityImageJson.xMarginCircle. */
const JSON_X_MARGIN_CIRCLE = 5;
/** BodierLikeClassOrObject#marginEmptyFieldsOrMethod, substituted by
 *  `getMethodOrFieldHeight` when the entries area is empty. */
const JSON_EMPTY_HEIGHT_FALLBACK = 13;
/** FontParam.OBJECT_STEREOTYPE's hardcoded size (12, italic) — shared by
 *  every EntityImage* header formula; independent of theme.fontSize. */
const STEREO_FONT_SIZE = 12;

/** `json Name {}` with no body, or a body that failed to parse (ast.ts's
 *  `State.jsonValue` doc) — measured as an empty object, the closest
 *  stand-in for "no data" that still exercises the real empty-entries path. */
const EMPTY_OBJECT_NODE: JsonNode = { kind: 'object', entries: [] };

/** Guillemet.GUILLEMET (`«`/`»`) — upstream's default wrapping when no
 *  `skinparam guillemet` override is configured. */
function wrapGuillemet(label: string): string {
  return `«${label}»`;
}

// ---------------------------------------------------------------------------
// Recursive dimension measurement (TextBlockCucaJSon#calculateDimension)
// ---------------------------------------------------------------------------

interface JsonDimNode {
  width: number;
  height: number;
}

function measureJsonCell(text: string, fontSpec: FontSpec, measurer: StringMeasurer): Dim {
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

/** `TextBlockArray#calculateDimensionSlow`: width = max, height = sum. */
function measureArrayNode(node: JsonNode & { kind: 'array' }, fontSpec: FontSpec, measurer: StringMeasurer): JsonDimNode {
  const items = node.items.map((i) => measureJsonNode(i, fontSpec, measurer));
  const width = items.length === 0 ? 0 : Math.max(...items.map((i) => i.width));
  const height = items.reduce((sum, i) => sum + i.height, 0);
  return { width, height };
}

/** `TextBlockJson#calculateDimensionSlow`: width = width1 (max key cell
 *  width) + width2 (max value cell/sub-table width); height = sum of
 *  per-member `max(keyDim.height, valueDim.height)`. */
function measureObjectNode(node: JsonNode & { kind: 'object' }, fontSpec: FontSpec, measurer: StringMeasurer): JsonDimNode {
  const members = node.entries.map((e) => ({
    keyDim: measureJsonCell(e.key, fontSpec, measurer),
    value: measureJsonNode(e.value, fontSpec, measurer),
  }));
  const width1 = members.length === 0 ? 0 : Math.max(...members.map((m) => m.keyDim.width));
  const width2 = members.length === 0 ? 0 : Math.max(...members.map((m) => m.value.width));
  const height = members.reduce((sum, m) => sum + Math.max(m.keyDim.height, m.value.height), 0);
  return { width: width1 + width2, height };
}

function measureJsonNode(node: JsonNode, fontSpec: FontSpec, measurer: StringMeasurer): JsonDimNode {
  if (node.kind === 'scalar') return measureJsonCell(scalarText(node), fontSpec, measurer);
  if (node.kind === 'array') return measureArrayNode(node, fontSpec, measurer);
  return measureObjectNode(node, fontSpec, measurer);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface MeasuredJsonState {
  width: number;
  height: number;
}

/**
 * Measure a `kind:'json'` state leaf (EntityImageJson#calculateDimensionSlow).
 * Unlike a normal state, there is no `hideEmptyDescription`/suppress
 * parameter — `hide members`/`hide empty members` have no `BodierJSon`-side
 * effect upstream (matches the class engine's `measureJsonClassifier`'s own
 * "no showFields" precedent).
 */
export function measureJsonState(state: State, theme: Theme, measurer: StringMeasurer): MeasuredJsonState {
  const fontSpec: FontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const nameM = measurer.measure(state.display, fontSpec);
  const nameDim: Dim = {
    width: nameM.width + JSON_NAME_MARGIN * 2,
    height: nameM.height + JSON_NAME_MARGIN * 2,
  };
  const stereoDim: Dim =
    state.stereotype === undefined
      ? { width: 0, height: 0 }
      : measurer.measure(wrapGuillemet(state.stereotype), { family: theme.fontFamily, size: STEREO_FONT_SIZE });
  const title: Dim = { width: Math.max(nameDim.width, stereoDim.width), height: nameDim.height + stereoDim.height };

  const dimNode = measureJsonNode(state.jsonValue ?? EMPTY_OBJECT_NODE, fontSpec, measurer);
  const fieldsHeight = dimNode.height === 0 ? JSON_EMPTY_HEIGHT_FALLBACK : dimNode.height;

  const width = Math.max(dimNode.width, title.width + JSON_X_MARGIN_CIRCLE * 2);
  const height = title.height + fieldsHeight;

  return { width, height };
}
