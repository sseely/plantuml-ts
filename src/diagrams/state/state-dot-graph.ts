/**
 * Flat state-diagram DOT-graph construction.
 *
 * Builds the `DotInputGraph` (nodes + edges — no clusters; composites are
 * T4's concern) consumed by the shared dot layout engine from a
 * `StateDiagramAST` whose states carry no children/concurrentRegions
 * anywhere (verified by the caller, ./layout.ts's `hasAnyComposite` guard).
 * Split out of ./layout.ts to keep both files under the project's per-file
 * size cap — mirrors class engine's class-dot-graph.ts (D1, duplicate
 * consciously, do not extract a shared base).
 *
 * @see ~/git/plantuml/.../svek/GeneralImageBuilder.java (per-kind image dispatch)
 * @see ~/git/plantuml/.../statediagram/StateDiagram.java#getStart/getEnd (per-scope shared [*] anchor)
 * @see ~/git/plantuml/.../svek/SvekEdge.java (minlen = arrow length - 1)
 * @see ~/git/plantuml/.../svek/DotStringFactory.java (nodesep/ranksep floors + rankdir)
 */

import type { NotePosition, State, StateDiagramAST, Transition } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { DotInputGraph, DotInputNode, DotInputEdge } from '../../core/graph-layout.js';
import { measureState, CIRCLE_START_SIZE, CIRCLE_END_SIZE } from './state-sizing.js';
import { buildNoteGraphPartsByScope } from './state-note-layout.js';

// ---------------------------------------------------------------------------
// [*] pseudostate anchors — one shared start/end node per (flat) diagram,
// mirroring StateDiagram#getStart/getEnd's per-scope quark caching.
// ---------------------------------------------------------------------------

export const INITIAL_ID = '__initial__';
export const FINAL_ID = '__final__';

/**
 * `plantuml.skin`'s `arrow { FontSize 13 }` block -- upstream's
 * `klimt/font/FontParam.java:54`, `ARROW(13, normal)` -- the transition/
 * edge-label default, distinct from `STATE(14, normal)` (body/entity-name
 * text, `theme.fontSize`'s own default). Mission G5/C0 jar-verified this
 * exact gap: `WidthTableMeasurer` is jar-exact at BOTH sizes (0.000% mean
 * error corpus-wide) -- the bug was this call site handing it size 14 for
 * text jar renders at size 13 (`bemena-23-zebu249`'s `"EvNewValueSaved"`:
 * 120.05px at 14 vs jar's real 111.475px at 13). Same pattern already
 * proven safe: `class-layout-helpers.ts#CARDINALITY_FONT_SIZE`,
 * `description/renderer-edge.ts`'s `ARROW_LABEL_FONT_SIZE` (both = 13).
 * No `skinparam ArrowFontSize` override path exists in this port yet
 * (`ELEMENT_BUCKET_SNAMES` in `core/skinparam.ts` does not include
 * `'arrow'`) -- this is the bare DEFAULT only, matching current behavior
 * for every fixture (none of which had a working override to lose).
 */
const ARROW_LABEL_FONT_SIZE = 13;

/** Resolve a transition endpoint id, redirecting the anonymous `[*]` token
 *  to the shared start (`from` position) or end (`to` position) anchor.
 *  Exported: `./layout.ts#buildFlatTransitionGeos` (mission G4 S2) reuses
 *  this SAME resolution for `TransitionGeo.from`/`to` -- previously that
 *  function pushed the RAW, unresolved AST endpoint string (`'[*]'`
 *  verbatim) instead, so `renderer.ts#svgEndpointId`'s `INITIAL_ID`/
 *  `FINAL_ID` check could never match a `[*]`-originating/-terminating
 *  flat-pipeline transition's `<path id="...">` value -- jar-verified
 *  broken on gefefe-91-xoge233/moleco-69-sida106 (`id="[*]-to-IDLE"`
 *  instead of jar's `id="*start*-to-IDLE"`). */
export function endpointId(raw: string, isFrom: boolean): string {
  if (raw !== '[*]') return raw;
  return isFrom ? INITIAL_ID : FINAL_ID;
}

function usesInitial(transitions: readonly Transition[]): boolean {
  return transitions.some((t) => t.from === '[*]');
}

function usesFinal(transitions: readonly Transition[]): boolean {
  return transitions.some((t) => t.to === '[*]');
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

function buildStateNode(
  state: State,
  hideEmptyDescription: boolean,
  theme: Theme,
  measurer: StringMeasurer,
  rankdir: 'TB' | 'LR',
): DotInputNode {
  const measured = measureState(state, hideEmptyDescription, theme, measurer, rankdir);
  return { id: state.id, width: measured.width, height: measured.height, shape: measured.shape };
}

function buildDotNodes(
  ast: StateDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
  rankdir: 'TB' | 'LR',
): DotInputNode[] {
  const hideEmptyDescription = ast.hideEmptyDescription ?? false;
  const nodes = ast.states.map((s) => buildStateNode(s, hideEmptyDescription, theme, measurer, rankdir));
  if (usesInitial(ast.transitions)) {
    nodes.push({ id: INITIAL_ID, width: CIRCLE_START_SIZE, height: CIRCLE_START_SIZE, shape: 'circle' });
  }
  if (usesFinal(ast.transitions)) {
    nodes.push({ id: FINAL_ID, width: CIRCLE_END_SIZE, height: CIRCLE_END_SIZE, shape: 'circle' });
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

/** Guard/action/plain label text for a transition — same precedence as the
 *  legacy layout code (kept here so both the flat and composite paths agree
 *  on label text derivation; ./layout.ts re-exports it for the legacy path). */
export function transitionLabelText(t: Transition): string | undefined {
  if (t.label !== undefined) return t.label;
  if (t.guard !== undefined && t.action !== undefined) return `[${t.guard}] / ${t.action}`;
  if (t.guard !== undefined) return `[${t.guard}]`;
  if (t.action !== undefined) return `/ ${t.action}`;
  return undefined;
}

/** `note on link` box padding — mirrors class engine's note-on-entity
 *  measurement (class/note-layout.ts's NOTE_HPAD/NOTE_VPAD/NOTE_FOLD); an
 *  `EntityImageNoteLink` is the same folded-corner note box, just merged
 *  into the edge's own label instead of laid out as a separate svek node. */
const LINK_NOTE_HPAD = 8;
const LINK_NOTE_VPAD = 6;
const LINK_NOTE_FOLD = 10;

interface LabelDims {
  width: number;
  height: number;
}

function measureLinkNote(text: string, font: { family: string; size: number }, measurer: StringMeasurer): LabelDims {
  const lines = text.split('\n');
  const lineHeight = font.size * 1.4;
  let maxW = 0;
  for (const ln of lines) maxW = Math.max(maxW, measurer.measure(ln, font).width);
  return {
    width: maxW + LINK_NOTE_HPAD * 2 + LINK_NOTE_FOLD,
    height: lines.length * lineHeight + LINK_NOTE_VPAD * 2,
  };
}

/** Combine a transition's own label with its attached `note on link`, per
 *  `SvekEdge.java:308-326`'s `mergeLR`/`mergeTB`: LEFT/TOP put the note
 *  ahead of the label, RIGHT/BOTTOM put it after — either way the merged
 *  box is the horizontal (LEFT/RIGHT) or vertical (TOP/BOTTOM) sum. Order
 *  doesn't affect the combined WIDTH/HEIGHT, only which side the (unmodeled)
 *  visual sits on, so this only needs the position's axis. */
function mergeNoteWithLabel(label: LabelDims | undefined, note: LabelDims, position: NotePosition): LabelDims {
  if (label === undefined) return note;
  if (position === 'left' || position === 'right') {
    return { width: label.width + note.width, height: Math.max(label.height, note.height) };
  }
  return { width: Math.max(label.width, note.width), height: label.height + note.height };
}

/** Edge label attrs (HTML-table label, svek convention — mirrors class
 *  engine's edgeLabelAttrs). Widths/heights are measured but tolerant: the
 *  DOT-parity comparator only checks label PRESENCE, not pixel size. */
function edgeLabelAttrs(
  t: Transition,
  font: { family: string; size: number },
  measurer: StringMeasurer,
): NonNullable<DotInputEdge['attributes']> {
  const text = transitionLabelText(t);
  const labelDims = text === undefined ? undefined : measurer.measure(text, font);
  const noteDims = t.linkNote === undefined ? undefined : measureLinkNote(t.linkNote, font, measurer);
  if (labelDims === undefined && noteDims === undefined) return {};
  const merged =
    noteDims === undefined ? labelDims! : mergeNoteWithLabel(labelDims, noteDims, t.linkNotePosition ?? 'bottom');
  // #lizard forgives -- pre-existing (CCN 12): two independent optional
  // dimension sources (label text, attached link-note) merged via early
  // returns, mirrors state-composite-edge-label.ts's own identical shape
  // (D1 duplication, not new branching). Surfaced by this file's full
  // rescan on ANY edit, not introduced here (mission G5/C1).
  return { label: text ?? t.linkNote ?? '', labelWidth: merged.width, labelHeight: merged.height };
}

/** Under `skinparam linetype ortho`, svek routes the main edge label through
 *  `xlabel` instead of `label` (SvekEdge.java:434-441: dotSplines == ORTHO
 *  branch) — taillabel/headlabel are unaffected (upstream only tests
 *  `dotMode`/`dotSplines` in the `hasNoteLabelText()` branch). Mutates in
 *  place; called only when linetype is ortho. Mirrors class engine's
 *  class-dot-graph.ts#moveLabelToXlabel (duplicated per this file's D1). */
function moveLabelToXlabel(attrs: NonNullable<DotInputEdge['attributes']>): void {
  if (attrs.label === undefined) return;
  attrs.xlabel = attrs.label;
  attrs.xlabelWidth = attrs.labelWidth!;
  attrs.xlabelHeight = attrs.labelHeight!;
  delete attrs.label;
  delete attrs.labelWidth;
  delete attrs.labelHeight;
}

function buildDotEdges(
  ast: StateDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): DotInputEdge[] {
  const font = { family: theme.fontFamily, size: ARROW_LABEL_FONT_SIZE };
  return ast.transitions.map((t, i) => {
    // minlen = arrow dash-count - 1 (SvekEdge.java) — shared convention with
    // class/object, not state-specific (mechanisms.md §4).
    const attributes: NonNullable<DotInputEdge['attributes']> = {
      minLen: (t.length ?? 2) - 1,
      ...edgeLabelAttrs(t, font, measurer),
    };
    if (theme.linetype === 'ortho') moveLabelToXlabel(attributes);
    return { id: `edge-${i}`, from: endpointId(t.from, true), to: endpointId(t.to, false), attributes };
  });
}

// ---------------------------------------------------------------------------
// Graph attrs
// ---------------------------------------------------------------------------

/** nodesep=35pt / ranksep=60pt floors (DotStringFactory.java) — same floors
 *  as class/object, applied via the shared emitter's resolveSep; explicit
 *  skinparam overrides skip the floor (mirrors class-dot-graph.ts's sepAttrs). */
function sepAttrs(theme: Theme): Partial<DotInputGraph> {
  return {
    nodeSep: theme.nodeSep ?? 35,
    rankSep: theme.rankSep ?? 60,
    ...(theme.nodeSep !== undefined ? { nodeSepExplicit: true } : {}),
    ...(theme.rankSep !== undefined ? { rankSepExplicit: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the flat-diagram DOT input graph. Caller (./layout.ts) guarantees no
 * state in `ast` carries children/concurrentRegions — composites route
 * through the legacy path until T4 lands child passes + cluster envelopes.
 */
/** Notes have no `State.children` membership, so they route into the flat
 *  graph separately, keyed on the diagram's OWN scope (`''` — the only scope
 *  a note can ever declare in when `hasAnyComposite` is false, mission A4
 *  Phase L iter 9). Mutates `nodes`/`edges` in place. */
function addNotes(
  ast: StateDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
  rankdir: 'TB' | 'LR',
  nodes: DotInputNode[],
  edges: DotInputEdge[],
): void {
  const parts = buildNoteGraphPartsByScope(ast.notes ?? [], theme, measurer, rankdir).get('');
  if (parts === undefined) return;
  nodes.push(...parts.nodes);
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const cand of parts.candidates) {
    if (!nodeIds.has(cand.target)) continue; // "Nothing to note to" already filtered at parse time
    edges.push({
      id: cand.id,
      from: cand.fromNote ? cand.noteId : cand.target,
      to: cand.fromNote ? cand.target : cand.noteId,
      attributes: { minLen: cand.minLen },
    });
  }
  // #lizard forgives -- pre-existing (6 params): the cohesive note-graph
  // mutation context (ast/theme/measurer/rankdir + the two flat-pipeline
  // accumulators it mutates in place) threaded from buildDotGraph's own
  // single call site, not new here (mission G5/C1).
}

export function buildDotGraph(
  ast: StateDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): DotInputGraph {
  const rankdir: 'TB' | 'LR' = ast.rankdir === 'left-to-right' ? 'LR' : 'TB';
  const nodes = buildDotNodes(ast, theme, measurer, rankdir);
  const edges = buildDotEdges(ast, theme, measurer);
  addNotes(ast, theme, measurer, rankdir, nodes, edges);
  return {
    nodes,
    edges,
    rankDir: rankdir,
    ...sepAttrs(theme),
    // mission G4 S8 (mechanism 19, mirrors G2 N29's identical class-engine
    // fix): state draws every transition's arrowhead as an inline
    // \x22<polygon>\x22 at the raw spline endpoint (mission G4 S1 mechanism 3),
    // not an SVG \x22<marker>\x22 -- jar's own svek-DOT emitter unconditionally
    // writes arrowtail=none,arrowhead=none on every edge line
    // (svek-dot-emit.ts, corpus-wide). Without this flag,
    // graph-layout-build.ts#addEdges defaults to arrowhead=normal and
    // graphviz-ts reserves a ~10-11px arrow-clip gap when solving the
    // spline, stopping every routed transition well short of its target
    // node's boundary -- verified against real `dot -Tplain` on
    // nelupe-49-xova546's own pinned svek-3.dot golden (see
    // tests/unit/state/state-manual-arrowheads.test.ts's doc comment for
    // the full derivation).
    manualArrowheads: true,
  };
}
