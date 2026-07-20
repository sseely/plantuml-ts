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
 * ledger.md` S1 for the full jar-verified mechanism writeups.
 */

import type { StateGeometry, StateNodeGeo, TransitionGeo } from './layout.js';
import type { Theme } from '../../core/theme.js';
import type { RenderFragment } from '../../core/dispatcher.js';
import { rect, text, path } from '../../core/svg.js';
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

/** Composite state's OWN shape only (dashed outer rect + top label) —
 *  children are NOT recursed here; {@link renderNodeWrapped} handles
 *  recursion so each child gets its own `<g>` wrap (mission G4 S1
 *  mechanism 2), unlike the pre-S1 `renderComposite` this replaces (which
 *  flattened children into the same unwrapped string). */
function renderCompositeShape(node: StateNodeGeo, theme: Theme): string {
  const outerBox = rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
    strokeWidth: 1,
    strokeDasharray: '6,3',
    rx: 8,
  });
  const label = text(
    node.x + node.width / 2,
    node.y + theme.fontSize + 4,
    node.display,
    {
      textAnchor: 'middle',
      fill: theme.colors.text,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
    },
  );
  return outerBox + label;
}

/** One node's own shape markup — children NOT recursed (see {@link
 *  renderCompositeShape}'s doc comment). */
function renderShape(node: StateNodeGeo, theme: Theme): string {
  if (node.children.length > 0) {
    return renderCompositeShape(node, theme);
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
 */
function wrapClassFor(node: StateNodeGeo): 'entity' | 'start_entity' | 'end_entity' | undefined {
  if (node.children.length > 0) return 'entity';
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
 *  `renderNode`'s flat, unwrapped recursion. */
function renderNodeWrapped(node: StateNodeGeo, theme: Theme, uidPlan: StateUidPlan): string {
  const ownShape = renderShape(node, theme);
  const childrenMarkup = node.children.map((c) => renderNodeWrapped(c, theme, uidPlan)).join('');
  const inner = ownShape + childrenMarkup;
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

function buildPathD(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  const p0 = points[0];
  if (p0 === undefined) return '';
  if (points.length === 1) return `M ${p0.x},${p0.y}`;

  if (points.length === 2) {
    const p1 = points[1]!;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const cp1x = p0.x + dx * 0.1;
    const cp1y = p0.y + dy * 0.45;
    const cp2x = p1.x - dx * 0.3;
    const cp2y = p1.y - dy * 0.4;
    return `M ${p0.x},${p0.y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
  }

  // Catmull-Rom → cubic Bézier for 3+ waypoints
  const parts: string[] = [`M ${p0.x},${p0.y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const prev = points[i > 0 ? i - 1 : 0]!;
    const curr = points[i]!;
    const next1 = points[i + 1]!;
    const next2 = points[i + 2 < points.length ? i + 2 : i + 1]!;
    const cp1x = curr.x + (next1.x - prev.x) / 6;
    const cp1y = curr.y + (next1.y - prev.y) / 6;
    const cp2x = next1.x - (next2.x - curr.x) / 6;
    const cp2y = next1.y - (next2.y - curr.y) / 6;
    parts.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next1.x},${next1.y}`);
  }
  return parts.join(' ');
}

/** `Link#idCommentForSvg`-ish `<path id="...">` value — jar names the
 *  pseudo-start/end endpoints `*start*`/`*end*` in this attribute (byte-
 *  compared, unlike `data-qualified-name`) regardless of this port's own
 *  internal `__initial__`/`__final__` ids (`state-dot-graph.ts`).
 *  Jar-verified `moleco-69-sida106` (`id="*start*-to-Main_Libre"`),
 *  `bajelo-54-dixe684` (`id="Track_FSM-to-*end*"`). */
function svgEndpointId(nodeId: string): string {
  if (nodeId === INITIAL_ID) return '*start*';
  if (nodeId === FINAL_ID) return '*end*';
  return nodeId;
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
  index: number,
): string {
  const inner = buildTransitionInnerMarkup(transition, theme);
  if (inner === '') return '';
  const uid = uidPlan.edgeUid[index] ?? '';
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
  geo.transitions.forEach((transition, index) => {
    children.push(renderTransitionWrapped(transition, theme, uidPlan, index));
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
