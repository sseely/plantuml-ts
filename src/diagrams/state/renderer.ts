/**
 * State diagram SVG renderer.
 *
 * Pure function: StateGeometry + Theme → SVG string.
 * No DOM, no async.
 *
 * mission G4 S1: routes through the CucaDiagram-family document shell
 * (`renderer-shell.ts#assembleStateShell`, mechanism 1) with one outer
 * content `<g>` and per-entity/per-link `<g>` wrapping (`renderer-
 * group.ts`, mechanism 2), inline-`<polygon>` transition arrowheads
 * (`renderer-arrowhead.ts`, mechanism 3), and the real `SvekResult`-style
 * document margin (`layout.ts#applyStateDocumentMargin` /
 * `layout-ink-extent.ts`, mechanism 4) — see `plans/g4-state-svg/
 * ledger.md` S1 for the full jar-verified mechanism writeups. mission G4
 * S2 adds the simple-state box + pseudostate content fidelity (mechanism
 * 5, `renderer-box.ts`/`renderer-pseudostate.ts`); mission G4 S3 adds the
 * composite box's own real 3-4-layer shape (mechanism 6,
 * `renderer-composite-box.ts`), replacing the pre-S3 dashed-rect
 * approximation for autonom composites.
 */

import type { StateGeometry, StateNodeGeo, TransitionGeo } from './layout.js';
import type { Theme } from '../../core/theme.js';
import type { RenderFragment } from '../../core/dispatcher.js';
import { path, text, line } from '../../core/svg.js';
import { resolveColorToSvgHex } from '../../core/klimt/color/HColorSet.js';
import { INITIAL_ID, FINAL_ID } from './state-dot-graph.js';
import { buildStateUidPlan } from './renderer-uid.js';
import type { StateUidPlan } from './renderer-uid.js';
import { wrapEntity, wrapStartEntity, wrapEndEntity, wrapLink } from './renderer-group.js';
import { buildTransitionArrowhead, applyHeadTrim } from './renderer-arrowhead.js';
import {
  renderInitial,
  renderFinal,
  renderForkJoin,
  renderChoiceJunction,
  renderHistory,
} from './renderer-pseudostate.js';
import { renderNormal } from './renderer-box.js';
import { renderComposite } from './renderer-composite-box.js';

// ---------------------------------------------------------------------------
// Node shape renderers
// ---------------------------------------------------------------------------

/**
 * `kind:'json'` leaf (mission A4 Phase L iter 20) — a plain labeled box,
 * the closest visual analog available today (`renderer-box.ts#renderNormal`
 * -- reused verbatim; a `kind:'json'` node's `headerLines` is never
 * populated at layout time, so it always takes that function's own
 * unmeasured-fallback path, UNCHANGED behavior pre/post mission G4 S2).
 * Faithful `shape=plaintext` TABLE content (member rows, matching class
 * engine's own json rendering) is deferred to future visual-fidelity work
 * — this renderer has no row-drawing infrastructure at all yet. Mirrors
 * the syncBar case's own documented no-dedicated-renderer-yet gap below.
 */
function renderJson(node: StateNodeGeo, theme: Theme): string {
  return renderNormal(node, theme);
}

/** One node's own shape markup — children NOT recursed (see {@link
 *  renderComposite}'s doc comment, renderer-composite-box.ts). */
function renderShape(node: StateNodeGeo, theme: Theme): string {
  if (node.children.length > 0) {
    return renderComposite(node, theme);
  }

  switch (node.kind) {
    case 'initial':
      return renderInitial(node);
    case 'final':
      return renderFinal(node);
    case 'fork':
    case 'join':
    // syncBar (T2 addition, `=name=` transition endpoints -- see
    // ast.ts's StateKind) has no dedicated renderer yet: reuses the
    // fork/join bar shape, the closest visual analog -- upstream itself
    // renders synchronization bars and fork/join with the same bar shape.
    case 'syncBar':
      return renderForkJoin(node);
    case 'choice':
      return renderChoiceJunction(node, theme);
    case 'history':
    case 'deepHistory':
      return renderHistory(node, theme);
    case 'normal':
      return renderNormal(node, theme);
    case 'json':
      return renderJson(node, theme);
    // #lizard forgives -- faithful one-branch-per-StateKind dispatch; each
    // case is a single delegating return, not real decision complexity.
  }
}

/**
 * mission G4 S1 mechanism 2: the `<g class="entity"|"start_entity"|
 * "end_entity">` wrap dispatch, jar-verified against `moleco-69-sida106`
 * (start_entity/entity), `cekolo-21-gini183` (every pseudostate stereotype
 * in one fixture -- choice wraps `entity`; fork/join bars and history/
 * deepHistory pseudostates draw UNWRAPPED, no `<g>` at all).
 *
 * Composite states (`children.length > 0`) always wrap `entity` here -- see
 * `renderer-group.ts`'s own "NOT MODELED" doc-comment note for the
 * jar-verified `entity`-vs-`cluster` (autonom vs non-autonom) split this
 * simplification does not yet capture.
 *
 * mission G4 S5: `node.emptyDescription === true` (the
 * `EntityImageStateEmptyDescription` shape, `renderer-box.ts
 * #renderEmptyDescription`'s own doc comment) draws UNWRAPPED too --
 * jar-verified `gopumi-11-pise779`'s own `S1` (bare `<rect>`+`<text>`
 * siblings, no `<g>` at all, matching fork/join/history/deepHistory's
 * existing unwrapped precedent above).
 */
function wrapClassFor(node: StateNodeGeo): 'entity' | 'start_entity' | 'end_entity' | undefined {
  if (node.children.length > 0) return 'entity';
  if (node.emptyDescription === true) return undefined;
  switch (node.kind) {
    case 'initial':
      return 'start_entity';
    case 'final':
      return 'end_entity';
    case 'fork':
    case 'join':
    case 'syncBar':
    case 'history':
    case 'deepHistory':
      return undefined;
    case 'choice':
    case 'normal':
    case 'json':
      return 'entity';
    // #lizard forgives -- faithful one-branch-per-StateKind dispatch.
  }
}

/** Renders one node (recursing into composite children) with its jar
 *  `<g>` wrap applied — the mechanism-2 replacement for the pre-S1
 *  `renderNode`'s flat, unwrapped recursion. mission G4 S5 (transition-
 *  nesting mechanism): this node's OWN pass edges (`node.transitions`)
 *  render as siblings of `childrenMarkup`, INSIDE this node's own wrap --
 *  matching jar's real document nesting (a pass's own edges are direct
 *  children of that pass's own image, `renderer-group.ts`'s doc comment,
 *  `bajelo-54-dixe684` jar-verified). */
/** `ConcurrentStates.java#Separator.drawSeparator`'s dashed rule between two
 *  stacked regions -- `THICKNESS_BORDER=1.5`, `DASH=8`/gap `10` (a FIXED
 *  jar constant, independent of theme border color/width elsewhere).
 *  jar-verified `nelupe-49-xova546`: `stroke:#181818;stroke-width:1.5;
 *  stroke-dasharray:8,10;`. */
function renderSeparator(sep: { x1: number; y1: number; x2: number; y2: number }, theme: Theme): string {
  return line(sep.x1, sep.y1, sep.x2, sep.y2, {
    stroke: theme.colors.border,
    strokeWidth: 1.5,
    strokeDasharray: '8,10',
  });
}

/** mission G4 S6, mechanism 13: a CONCURRENT-region-owning composite
 *  interleaves each stacked region's own states+transitions with a dashed
 *  `renderSeparator` line BETWEEN each pair -- jar's real document
 *  structure never wraps a region in its own `<g>`
 *  (`ConcurrentStates.java#drawU` draws each `inner`'s content directly,
 *  then the separator, in one flat sequence inside the OWNING composite's
 *  own image). Every other node (`node.concurrentRegions === undefined`)
 *  keeps the pre-S6 "all children, then this node's own transitions"
 *  layout unchanged. */
function renderNodeWrapped(node: StateNodeGeo, theme: Theme, uidPlan: StateUidPlan): string {
  const ownShape = renderShape(node, theme);
  let inner: string;
  if (node.concurrentRegions !== undefined) {
    const separators = node.separators ?? [];
    const blocks = node.concurrentRegions.map((region, i) => {
      const stateMarkup = region.children.map((c) => renderNodeWrapped(c, theme, uidPlan)).join('');
      const transitionMarkup = region.transitions.map((t) => renderTransitionWrapped(t, theme, uidPlan)).join('');
      const sepMarkup = i < separators.length ? renderSeparator(separators[i]!, theme) : '';
      return stateMarkup + transitionMarkup + sepMarkup;
    });
    inner = ownShape + blocks.join('');
  } else {
    const childrenMarkup = node.children.map((c) => renderNodeWrapped(c, theme, uidPlan)).join('');
    const ownTransitionsMarkup = node.transitions
      .map((t) => renderTransitionWrapped(t, theme, uidPlan))
      .join('');
    inner = ownShape + childrenMarkup + ownTransitionsMarkup;
  }
  const wrapClass = wrapClassFor(node);
  if (wrapClass === undefined) return inner;
  const uid = uidPlan.nodeUid.get(node.id) ?? '';
  if (wrapClass === 'start_entity') return wrapStartEntity(node.id, uid, inner);
  if (wrapClass === 'end_entity') return wrapEndEntity(node.id, uid, inner);
  return wrapEntity(node.id, uid, inner);
}

// ---------------------------------------------------------------------------
// Transition renderer
// ---------------------------------------------------------------------------

/**
 * mission G4 S8 (mechanism 19): `TransitionGeo.points` is a well-formed
 * `1 + 3*n` cubic-bezier spline for every real dot-layout-driven transition
 * -- confirmed by direct inspection of `layoutState()`'s own raw output
 * (`state-manual-arrowheads.test.ts`'s doc comment) -- jar's own `DotPath`
 * draws it as a genuine SVG cubic bezier chain (`Mx,y Cx1,y1 x2,y2 x,y
 * [Cx1,y1 x2,y2 x,y ...]`, repeating the `C` command once per 3-point
 * group), NOT a polyline OR a re-interpolated Catmull-Rom curve through the
 * control points -- the pre-S8 implementation's own Catmull-Rom smoothing
 * was WRONG: it discarded the already-correct bezier control-point
 * structure `applyHeadTrim` (renderer-arrowhead.ts) already assumes and
 * re-derived extra, spurious segments (jar-verified regression:
 * `nelupe-49-xova546`'s `*start*s7_2-to-chat1` -- jar draws ONE 4-point
 * segment, the pre-S8 port drew THREE). Mirrors `class/renderer.ts
 * #buildPathData` exactly (G2 N5), including its straight-`L`-segment
 * fallback for any point list that ISN'T `1 + 3*n`
 * (`points.length < 4` or `(points.length - 1) % 3 !== 0`) -- the
 * degenerate/hand-built 2-point secant case a caller might still construct
 * outside the real layout pipeline (unit tests).
 */
function buildPathD(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  if (first === undefined) return '';
  const start = `M${first.x},${first.y}`;

  const isBezierSpline = points.length >= 4 && (points.length - 1) % 3 === 0;
  if (isBezierSpline) {
    const segments: string[] = [];
    for (let i = 1; i < points.length; i += 3) {
      const c1 = points[i]!;
      const c2 = points[i + 1]!;
      const end = points[i + 2]!;
      segments.push(`C${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`);
    }
    return [start, ...segments].join(' ');
  }

  const segments = rest.map((p) => `L${p.x},${p.y}`);
  return [start, ...segments].join(' ');
}

/** `Link#idCommentForSvg`-ish `<path id="...">` value — jar names the
 *  pseudo-start/end endpoints `*start*`/`*end*` in this attribute (byte-
 *  compared, unlike `data-qualified-name`) regardless of this port's own
 *  internal `__initial__`/`__final__` ids (`state-dot-graph.ts`).
 *  Jar-verified `moleco-69-sida106` (`id="*start*-to-Main_Libre"`),
 *  `bajelo-54-dixe684` (`id="Track_FSM-to-*end*"`).
 *
 *  mission G4 S7 (discovered while jar-verifying mechanism 10's own fix):
 *  the COMPOSITE pipeline's own scope-local pseudo anchors
 *  (`state-composite-pass.ts#scopedPseudoIds`, `__init_<scopeId>`/
 *  `__final_<scopeId>`) also need this `*start*<name>`/`*end*<name>` form
 *  -- jar's real `StateDiagram#getStart`/`#getEnd` build the SAME
 *  `"*start*" + g.getName()` string upstream regardless of nesting depth,
 *  where `g.getName()` is the OWNING GROUP's own LOCAL (never fully-
 *  qualified) name. For a CONCURRENT_STATE region, that local name is the
 *  bare synthetic `CONC<n>` segment (`StateDiagram#concurrentState`'s own
 *  `getUniqueSequence2(CONCURRENT_PREFIX)`), NOT this port's own
 *  internally-qualified `concurrentRegionScopeId` (`<ownerId>::CONC<n>`,
 *  deliberately over-qualified for THIS port's own cross-region dedup) --
 *  so a `::`-qualified scope id is stripped to its trailing `CONC<n>`
 *  segment. jar-verified `nelupe-49-xova546`: `*start*s7_2-to-chat1`
 *  (owner-level, unqualified already), `*start*toutou9-to-leo` (nested
 *  composite, unqualified already), `*start*CONC1-to-toutou9` (region,
 *  qualified `s7_2::CONC1` stripped to `CONC1`). */
function svgEndpointId(nodeId: string): string {
  if (nodeId === INITIAL_ID) return '*start*';
  if (nodeId === FINAL_ID) return '*end*';
  const scopedInit = /^__init_(.*)$/.exec(nodeId);
  if (scopedInit !== null) return `*start*${localScopeName(scopedInit[1]!)}`;
  const scopedFinal = /^__final_(.*)$/.exec(nodeId);
  if (scopedFinal !== null) return `*end*${localScopeName(scopedFinal[1]!)}`;
  return nodeId;
}

/** Strips this port's own `<ownerId>::CONC<n>` internal qualification down
 *  to the bare trailing segment jar's own unqualified `getName()` produces
 *  -- see {@link svgEndpointId}'s own doc comment for the full mechanism.
 *  A non-region scope id (no `::`) is already local, unchanged. */
function localScopeName(scopeId: string): string {
  const i = scopeId.lastIndexOf('::');
  return i === -1 ? scopeId : scopeId.slice(i + 2);
}

/** Path + inline arrowhead + optional label — the wrapped `<g class=
 *  "link">`'s inner content, split out of {@link renderTransitionWrapped}
 *  to stay under this project's per-function NLOC cap. mission G4 S1
 *  mechanism 3: inline `<polygon>` arrowhead instead of a `<marker>`
 *  reference -- `ExtremityArrow`'s decorationLength-based path trim
 *  (`applyHeadTrim`) must run BEFORE `buildPathD` so the connecting line
 *  stops at the arrow's outer edge, matching jar exactly. */
function buildTransitionInnerMarkup(transition: TransitionGeo, theme: Theme): string {
  const arrowhead = buildTransitionArrowhead(transition, theme.colors.arrow, 1);
  const points = applyHeadTrim(transition.points, arrowhead.trim);
  const d = buildPathD(points);
  if (d === '') return '';

  const pathEl = path(d, {
    stroke: theme.colors.arrow,
    strokeWidth: 1,
    id: `${svgEndpointId(transition.from)}-to-${svgEndpointId(transition.to)}`,
  });

  const labelEl =
    transition.label === undefined
      ? ''
      : text(transition.label.x, transition.label.y, transition.label.text, {
          fontFamily: theme.fontFamily,
          fontSize: theme.fontSize,
          fill: theme.colors.text,
        });

  return pathEl + arrowhead.markup + labelEl;
}

function renderTransitionWrapped(
  transition: TransitionGeo,
  theme: Theme,
  uidPlan: StateUidPlan,
): string {
  const inner = buildTransitionInnerMarkup(transition, theme);
  if (inner === '') return '';
  const uid = uidPlan.edgeUid.get(transition) ?? '';
  return wrapLink(
    {
      from: transition.from,
      to: transition.to,
      uid,
      fromUid: uidPlan.resolveNodeUid(transition.from),
      toUid: uidPlan.resolveNodeUid(transition.to),
    },
    inner,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a state diagram geometry into an SVG string.
 */
export function renderState(geo: StateGeometry, theme: Theme): RenderFragment {
  const uidPlan = buildStateUidPlan(geo);

  const children: string[] = [];
  for (const node of geo.states) {
    children.push(renderNodeWrapped(node, theme, uidPlan));
  }
  geo.transitions.forEach((transition) => {
    children.push(renderTransitionWrapped(transition, theme, uidPlan));
  });

  // mission G4 S1 mechanism 1: background is communicated via the shell's
  // own root `style="...background:...;"` attribute (`renderer-shell.ts`
  // / `core/klimt/document-shell.ts#assembleDocumentShell`) -- jar draws
  // NO explicit full-canvas `<rect>` for it (verified: every sampled state
  // fixture's `<defs/>` is immediately followed by the content `<g>`, no
  // background rect). The pre-S1 renderer's own manual background `<rect>`
  // is removed accordingly.
  return {
    body: children.join(''),
    width: geo.totalWidth,
    height: geo.totalHeight,
    background: resolveColorToSvgHex(theme.colors.background),
    stateShell: true,
  };
}
