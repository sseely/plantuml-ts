/**
 * Leaf-node DOT sizing/shape (mission A4/T4 + Phase L Gap 1) — pure move out
 * of state-composite-pass.ts to keep that file under the repo's 500-line
 * cap (`buildLeafNode` grew past the cap once the Gap 1 border-point
 * plaintext/rect shape branch was added). No behavior change.
 *
 * @see ~/git/plantuml/.../svek/image/EntityImageStateBorder.java
 * @see ~/git/plantuml/.../svek/SvekNode.java#appendLabelHtmlSpecialForPort
 */

import type { State } from './ast.js';
import type { FontSpec, StringMeasurer } from '../../core/measurer.js';
import type { Theme } from '../../core/theme.js';
import type { DotInputNode } from '../../core/graph-layout.js';
import { measureState } from './state-sizing.js';
import {
  getEntityPosition,
  usesPortShape,
  BORDER_POINT_SIZE,
  PORT_LABEL_WIDE_THRESHOLD,
  PORT_TABLE_PAD_FLOOR,
} from './state-entity-position.js';

/** The subset of `DiagramCtx` (state-composite-pass.ts) `buildLeafNode`
 *  actually reads — kept narrow/structural rather than importing the full
 *  `DiagramCtx` type to avoid a needless coupling to that module's other
 *  (pass-bookkeeping) fields. */
export interface LeafNodeCtx {
  theme: Theme;
  measurer: StringMeasurer;
  rankdir: 'TB' | 'LR';
}

/** A leaf node's DOT sizing — normal-kind measurement or the fixed
 *  border-point box (EntityPosition != NORMAL overrides StateKind sizing
 *  regardless of stereotype-derived kind — mechanisms.md §1). */
export function buildLeafNode(s: State, ctx: LeafNodeCtx): DotInputNode {
  const pos = getEntityPosition(s);
  if (pos !== 'normal') {
    if (!usesPortShape(pos)) {
      // INPUT_PIN/OUTPUT_PIN/EXPANSION_* — EntityPosition.getShapeType()
      // stays plain RECTANGLE; no :P suffix (usePortP() false — no corpus
      // fixture exercises these kinds, mechanisms.md §4/state-entity-position.ts).
      return { id: s.id, width: BORDER_POINT_SIZE, height: BORDER_POINT_SIZE, shape: 'rect' };
    }
    // ENTRY_POINT/EXIT_POINT: isPort stays true regardless of the shape
    // branch below (EntityPosition.usePortP() — drives the `:P` edge-ref
    // suffix AND the cluster emitter's port/rank-group placement,
    // state-entity-position.ts, resolveClusterComposite in
    // state-composite-pass.ts).
    // SvekNode#appendLabelHtmlSpecialForPort (EntityImageStateBorder
    // #getMaxWidthFromLabelForEntryExit): the entity's OWN display-text
    // width picks plaintext HTML port table (>40px) vs a plain small rect.
    const font: FontSpec = { family: ctx.theme.fontFamily, size: ctx.theme.fontSize };
    const labelWidth = ctx.measurer.measure(s.display, font).width;
    const node: DotInputNode = {
      id: s.id, width: BORDER_POINT_SIZE, height: BORDER_POINT_SIZE, isPort: true, shape: 'rect',
    };
    if (labelWidth > PORT_LABEL_WIDE_THRESHOLD) {
      node.shape = 'plaintext';
      node.portPad = Math.max(PORT_TABLE_PAD_FLOOR, labelWidth - PORT_LABEL_WIDE_THRESHOLD);
    }
    return node;
  }
  const measured = measureState(s, false, ctx.theme, ctx.measurer, ctx.rankdir);
  return { id: s.id, width: measured.width, height: measured.height, shape: measured.shape };
}
