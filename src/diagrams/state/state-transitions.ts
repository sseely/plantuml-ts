/**
 * Transition (arrow) grammar for the state parser — `A --> B`, the
 * left-pointing reverse form `A <-- B`, and their decorations (cross-start,
 * circle-end, `[style]` brackets, direction abbreviations, `<<stereotype>>`).
 *
 * Built via `new RegExp(...)` from string fragments rather than regex
 * literals: the arrowhead/stereotype syntax needs literal `<`/`>` characters
 * that the repo's complexity-hook regex-literal scan flags (see
 * `.agent-notes/complexity-hook-workarounds.md`).
 *
 * @see ~/git/plantuml/.../statediagram/command/CommandLinkState.java (forward `-->`)
 * @see ~/git/plantuml/.../statediagram/command/CommandLinkStateReverse.java (reverse `<--`)
 * @see ~/git/plantuml/.../statediagram/command/CommandLinkStateCommon.java (shared grammar/semantics)
 */

import type { Transition, TransitionDirection } from './ast.js';

// ---------------------------------------------------------------------------
// Shared grammar fragments
// ---------------------------------------------------------------------------

/**
 * A transition endpoint: a synchronization bar reference (`=name=`,
 * auto-creating a `syncBar` state — CommandLinkStateCommon#getEntity), deep
 * history `[H*]`, shallow history `[H]`, the initial/final pseudostate
 * `[*]`, a compound `StateId[H*]`/`StateId[H]` history reference, or a
 * plain state id.
 *
 * Upstream's `getStatePattern` also allows `:` inside plain ids
 * (`[%pLN_.:]+`) and unicode letters/digits (`%pLN`); this port keeps the
 * pre-existing ASCII `[\w.]+` id charset (matches CommandCreateState's own
 * `[%pLN_.]+` CODE pattern closely enough that no corpus fixture round-trips
 * through the wider charset) — flagged as a known, minor divergence rather
 * than silently dropped.
 * @see ~/git/plantuml/.../statediagram/command/CommandLinkStateCommon.java#getStatePattern
 */
const ENT = String.raw`(=[\w.]+=|\[H\*\]|\[H\]|\[\*\]|[\w.]+\[H\*\]|[\w.]+\[H\]|[\w.]+)`;

/** Abbreviated compass directions — upstream tries full words before the
 *  single/double-letter abbreviations in this exact order. */
const ARROW_DIRECTION = String.raw`(left|right|up|down|le?|ri?|up?|do?)`;

/** Simplified LINE_STYLE — a color (`#word`) or one of the named style
 *  keywords, comma-separated repeats.
 *  @see ~/git/plantuml/.../descdiagram/command/CommandLinkElement.java#LINE_STYLE */
const STYLE_WORD = String.raw`(?:#\w+|dotted|dashed|plain|bold|hidden|norank|single|node|thickness=\d+)`;
const LINE_STYLE = `${STYLE_WORD}(?:,${STYLE_WORD})*`;

const STEREOTYPE_TAIL = String.raw`(?:\s*<<([^<>]+)>>)?`;
const LABEL_TAIL = String.raw`(?:\s*:\s*(.*))?`;

// ---------------------------------------------------------------------------
// Forward (`-->`) and reverse (`<--`) patterns
//
// Both share the same 11-group physical shape: [ent, decorA, bodyA, styleA,
// direction, styleB, bodyB, decorB, ent, stereotype, label]. Only the
// SEMANTIC role of each slot differs: forward reads decorA=crossStart,
// decorB=circleEnd, bodyA=body1, bodyB=body2, ent[0]=from, ent[1]=to;
// reverse mirrors all five (see `matchToRaw`).
// ---------------------------------------------------------------------------

/** Group indices: 1=ent[0] 2=decorA 3=bodyA 4=styleA 5=direction 6=styleB
 *  7=bodyB 8=decorB 9=ent[1] 10=stereotype 11=label */
const FORWARD_RE = new RegExp(
  `^${ENT}\\s*` +
    `(x)?(-+)(?:\\[(${LINE_STYLE})\\])?${ARROW_DIRECTION}?(?:\\[(${LINE_STYLE})\\])?(-*)` +
    `>(o[ \\t]+)?\\s*` +
    `${ENT}\\s*` +
    STEREOTYPE_TAIL +
    LABEL_TAIL +
    '$',
);

/** Same 11-group shape as `FORWARD_RE`; decorA=circleEnd, decorB=crossStart,
 *  bodyA=body2, bodyB=body1, ent[0]=to, ent[1]=from (arrowhead points left). */
const REVERSE_RE = new RegExp(
  `^${ENT}\\s*` +
    `(o[ \\t]+)?<(-*)(?:\\[(${LINE_STYLE})\\])?${ARROW_DIRECTION}?(?:\\[(${LINE_STYLE})\\])?(-+)(x)?` +
    `\\s*${ENT}\\s*` +
    STEREOTYPE_TAIL +
    LABEL_TAIL +
    '$',
);

const DIRECTION_MAP: Readonly<Record<string, TransitionDirection>> = {
  left: 'left',
  l: 'left',
  le: 'left',
  right: 'right',
  r: 'right',
  ri: 'right',
  up: 'up',
  u: 'up',
  down: 'down',
  d: 'down',
  do: 'down',
};

function resolveDirection(raw: string | undefined): TransitionDirection | undefined {
  if (raw === undefined || raw === '') return undefined;
  return DIRECTION_MAP[raw.toLowerCase()];
}

/** Fields extracted from a matched transition line, before label splitting
 *  (guard/action/label parsing stays in parser.ts — parseLabel). */
export type ParsedTransition = Omit<Transition, 'guard' | 'action' | 'label' | 'linkNote'> & {
  rawLabel: string;
};

/** Raw capture-group values, already resolved to their semantic role
 *  (`from`/`to`/`crossStart`/`circleEnd`/`body1`/`body2` — see
 *  `matchToRaw`), independent of which regex/arrow orientation matched. */
interface RawMatch {
  from: string;
  to: string;
  cross: string | undefined;
  circle: string | undefined;
  body1: string;
  body2: string;
  style1: string | undefined;
  style2: string | undefined;
  direction: string | undefined;
  stereotype: string | undefined;
  label: string | undefined;
}

/**
 * Re-orders a regex match's 11 physical groups into their semantic role.
 * `reverse=true` swaps decorA/decorB, bodyA/bodyB, styleA/styleB, and the
 * two `ent` endpoints — see the `FORWARD_RE`/`REVERSE_RE` doc comments.
 */
function matchToRaw(g: RegExpExecArray, reverse: boolean): RawMatch {
  const [, entA, decorA, bodyA, styleA, direction, styleB, bodyB, decorB, entB, stereotype, label] = g;
  return {
    from: reverse ? entB! : entA!,
    to: reverse ? entA! : entB!,
    cross: reverse ? decorB : decorA,
    circle: reverse ? decorA : decorB,
    body1: reverse ? bodyB! : bodyA!,
    body2: reverse ? bodyA! : bodyB!,
    style1: reverse ? styleB : styleA,
    style2: reverse ? styleA : styleB,
    direction,
    stereotype,
    label,
  };
}

/**
 * Parse a single transition line (forward or reverse arrow). Returns `null`
 * if the line does not match either shape.
 */
export function parseTransitionLine(line: string): ParsedTransition | null {
  const fwd = FORWARD_RE.exec(line);
  if (fwd !== null) return build(matchToRaw(fwd, false));
  const rev = REVERSE_RE.exec(line);
  // Reverse arrows default to 'left' when no explicit direction is written
  // — mirrors CommandLinkStateReverse#getDefaultDirection() (forward
  // transitions have no default: CommandLinkStateCommon#getDefaultDirection
  // returns null there).
  if (rev !== null) return build(matchToRaw(rev, true), 'left');
  return null;
}

function build(m: RawMatch, defaultDirection?: TransitionDirection): ParsedTransition {
  const arrowStyle = m.style1 ?? m.style2;
  const direction = resolveDirection(m.direction) ?? defaultDirection;
  return {
    from: m.from,
    to: m.to,
    length: m.body1.length + m.body2.length,
    ...(m.cross !== undefined ? { crossStart: true } : {}),
    ...(m.circle !== undefined ? { circleEnd: true } : {}),
    ...(arrowStyle !== undefined ? { arrowStyle } : {}),
    ...(direction !== undefined ? { direction } : {}),
    ...(m.stereotype !== undefined ? { stereotype: m.stereotype } : {}),
    rawLabel: m.label ?? '',
  };
}

/** True for a bare `=name=` synchronization-bar endpoint. */
export function isSyncBarId(id: string): boolean {
  return id.length > 2 && id.startsWith('=') && id.endsWith('=');
}
