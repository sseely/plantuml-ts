/**
 * Parser for PlantUML chart diagrams (@startchart / @endchart).
 *
 * A flat, priority-ordered dispatch chain over trimmed lines: axes, then
 * series (bar/line/area/scatter), then title/legend/stackMode/orientation/
 * annotation. Per-line-shape handlers live in `line-handlers.ts`; shared
 * regex constants and value-parsing helpers live in `parse-helpers.ts` —
 * both split out of this file (mission G0b/T6) purely to stay under the
 * project's 500-line file cap; no behavior change beyond the chrome
 * annotation-matcher wiring documented below.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type { ChartDiagramAST } from './ast.js';
import { createAnnotations, matchAnnotationCommand } from '../../core/annotations/index.js';
import { extractStyleMap, makeAxis } from './parse-helpers.js';
import type { StyleMap } from '../../core/skinparam.js';
import {
  tryArea, tryBar, tryChartAnnotation, tryChartLegend, tryGrid, tryHAxis, tryLine,
  tryOrientation, tryScatter, tryStackMode, tryTitle, tryV2Axis, tryVAxis,
} from './line-handlers.js';

/** Uniform shape every dispatch-chain handler is called through: `(ast,
 *  line, styleMap)`, in that argument order. Handlers that don't need
 *  `styleMap` (axes, title, legend) simply declare fewer parameters and
 *  ignore the extra positional argument -- safe ONLY because every handler
 *  agrees on this same (ast, line, styleMap) order (see project note on
 *  the activity/node-dispatch.ts parameter-misalignment bug this mirrors
 *  the fix for). */
type ChartLineHandler = (ast: ChartDiagramAST, line: string, styleMap: StyleMap) => boolean;

const PRIMARY_HANDLERS: readonly ChartLineHandler[] = [
  tryV2Axis, tryVAxis, tryHAxis, tryGrid, tryBar, tryLine, tryArea, tryScatter, tryTitle,
  tryChartLegend,
];

const SECONDARY_HANDLERS: readonly ChartLineHandler[] = [tryStackMode, tryOrientation, tryChartAnnotation];

/** True for anything shaped like a `title` directive (single-line or the
 *  bare multiline opener) — kept OUT of the shared chrome annotation
 *  matcher below so title parsing stays on `tryTitle`'s existing bespoke
 *  path, unchanged, per the T6 spec (T8 migrates chart's title to shared
 *  chrome; two mechanisms must not both consume `title` in the interim). */
function isTitleShapedLine(t: string): boolean {
  return /^title\b/i.test(t);
}

/**
 * Dispatch one trimmed, non-blank line at index `i` of `lines`. Handlers
 * run in upstream priority order (axes, then series, then title/legend);
 * `tryChartLegend` (chart's own `legend left|right|top|bottom` position
 * command) is tried BEFORE the shared chrome matcher so `legend right`
 * resolves as a position, never as chrome legend TEXT "right" — see
 * `line-handlers.ts#tryChartLegend`'s doc comment. Returns the number of
 * lines consumed (> 1 only when the chrome matcher consumed a multiline
 * title/caption/legend/header/footer block).
 */
function dispatchChartLine(
  ast: ChartDiagramAST,
  lines: readonly string[],
  i: number,
  line: string,
  styleMap: StyleMap,
): number {
  for (const handler of PRIMARY_HANDLERS) {
    if (handler(ast, line, styleMap)) return 1;
  }

  if (!isTitleShapedLine(line)) {
    const annotationMatch = matchAnnotationCommand(lines, i, ast.chrome!);
    if (annotationMatch !== null) return annotationMatch.consumed;
  }

  for (const handler of SECONDARY_HANDLERS) {
    if (handler(ast, line, styleMap)) break;
  }
  return 1;
}

export function parseChart(source: UmlSource): ChartDiagramAST {
  const ast: ChartDiagramAST = {
    title: '',
    hAxis: makeAxis(),
    vAxis: makeAxis(),
    v2Axis: null,
    series: [],
    legendPosition: 'none',
    stackMode: 'grouped',
    orientation: 'vertical',
    annotations: [],
    errors: [],
    chrome: createAnnotations(),
  };

  const styleMap = extractStyleMap(source);
  const lines = source.lines;

  for (let i = 0; i < lines.length; ) {
    const line = lines[i]!.trim();
    if (line === '') {
      i++;
      continue;
    }
    i += dispatchChartLine(ast, lines, i, line, styleMap);
  }

  return ast;
}
