/**
 * Transition edge label/xlabel attribute building — split out of
 * ./state-composite-pass.ts (mission A4 Phase L, 500-line file-cap
 * compliance; pure move, zero behavior change) for its own coherent
 * concern: turning a `Transition`'s guard/action/label/note-on-link fields
 * into the DOT edge `label`/`labelWidth`/`labelHeight` (or `xlabel*` under
 * `skinparam linetype ortho`) attributes.
 *
 * @see ~/git/plantuml/.../svek/SvekEdge.java
 */

import type { NotePosition, Transition } from './ast.js';
import type { FontSpec, StringMeasurer } from '../../core/measurer.js';
import type { DotInputEdge } from '../../core/graph-layout.js';
import type { DiagramCtx } from './state-composite-pass.js';

/** Guard/action/plain label — same precedence as ./state-dot-graph.ts's
 *  `transitionLabelText` (duplicated to avoid an import cycle: layout.ts
 *  imports ./state-composite-pass.ts; both read the same four `Transition`
 *  fields). */
function transitionLabelOf(t: Transition): string | undefined {
  if (t.label !== undefined) return t.label;
  if (t.guard !== undefined && t.action !== undefined) return `[${t.guard}] / ${t.action}`;
  if (t.guard !== undefined) return `[${t.guard}]`;
  if (t.action !== undefined) return `/ ${t.action}`;
  return undefined;
}

/** `note on link` box padding — duplicated from ./state-dot-graph.ts (D1,
 *  same avoid-import-cycle rationale as `transitionLabelOf` above). Mirrors
 *  class engine's note-on-entity measurement (class/note-layout.ts). */
const LINK_NOTE_HPAD = 8;
const LINK_NOTE_VPAD = 6;
const LINK_NOTE_FOLD = 10;

interface LabelDims {
  width: number;
  height: number;
}

function measureLinkNote(text: string, font: FontSpec, measurer: StringMeasurer): LabelDims {
  const lines = text.split('\n');
  const lineHeight = font.size * 1.4;
  let maxW = 0;
  for (const ln of lines) maxW = Math.max(maxW, measurer.measure(ln, font).width);
  return {
    width: maxW + LINK_NOTE_HPAD * 2 + LINK_NOTE_FOLD,
    height: lines.length * lineHeight + LINK_NOTE_VPAD * 2,
  };
}

/** Combine a transition's own label with its attached `note on link` — see
 *  ./state-dot-graph.ts's `mergeNoteWithLabel` (SvekEdge.java:308-326). */
function mergeNoteWithLabel(label: LabelDims | undefined, note: LabelDims, position: NotePosition): LabelDims {
  if (label === undefined) return note;
  if (position === 'left' || position === 'right') {
    return { width: label.width + note.width, height: Math.max(label.height, note.height) };
  }
  return { width: Math.max(label.width, note.width), height: label.height + note.height };
}

type EdgeAttrs = NonNullable<DotInputEdge['attributes']>;

function edgeLabelAttrs(t: Transition, font: FontSpec, measurer: StringMeasurer): EdgeAttrs {
  const text = transitionLabelOf(t);
  const labelDims = text === undefined ? undefined : measurer.measure(text, font);
  const noteDims = t.linkNote === undefined ? undefined : measureLinkNote(t.linkNote, font, measurer);
  if (labelDims === undefined && noteDims === undefined) return {};
  const merged =
    noteDims === undefined ? labelDims! : mergeNoteWithLabel(labelDims, noteDims, t.linkNotePosition ?? 'bottom');
  return { label: text ?? t.linkNote ?? '', labelWidth: merged.width, labelHeight: merged.height };
  // #lizard forgives -- pure move from state-composite-pass.ts (mission A4
  // Phase L file-cap split), unchanged logic: two independent optional
  // dimension sources merged, no new branching.
}

/** Under `skinparam linetype ortho`, svek routes the main edge label through
 *  `xlabel` instead of `label` (SvekEdge.java:434-441) — duplicated from
 *  ./state-dot-graph.ts's `moveLabelToXlabel` (D1). */
function moveLabelToXlabel(attrs: EdgeAttrs): void {
  if (attrs.label === undefined) return;
  attrs.xlabel = attrs.label;
  attrs.xlabelWidth = attrs.labelWidth!;
  attrs.xlabelHeight = attrs.labelHeight!;
  delete attrs.label;
  delete attrs.labelWidth;
  delete attrs.labelHeight;
}

export function buildEdgeAttrs(t: Transition, font: FontSpec, ctx: DiagramCtx): EdgeAttrs {
  const attrs: EdgeAttrs = {
    minLen: (t.length ?? 2) - 1,
    ...edgeLabelAttrs(t, font, ctx.measurer),
  };
  if (ctx.theme.linetype === 'ortho') moveLabelToXlabel(attrs);
  return attrs;
}
