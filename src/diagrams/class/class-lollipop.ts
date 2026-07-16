/**
 * Interface lollipop shorthand: `Name ()-- Existing` / `Existing --() Name`.
 *
 * This is upstream `CommandLinkLollipop` — a command DISTINCT from both:
 *  - the general relationship arrow's single `(`/`)` decor glyph
 *    (class-relationship-parser.ts, `CommandLinkClass` — decorates an edge
 *    between two ALREADY-DECLARED classifiers, no new entity created), and
 *  - the standalone `() "name"` declaration (class-commands.ts rule 5b'',
 *    `CommandCreateElementParenthesis` — `shape=plaintext`, no link).
 *
 * `CommandLinkLollipop` both creates a brand-new small-circle leaf (the
 * lollipop) AND links it to an entity that must already exist. Split into its
 * own module (mirrors class-assoc-couple.ts's precedent for a similarly
 * classifier-synthesising relationship shorthand) to keep both
 * class-commands.ts and class-relationship-parser.ts under the repo's
 * 500-line-per-file cap.
 *
 * @see ~/git/plantuml/.../classdiagram/command/CommandLinkLollipop.java
 */

import type { ClassDiagramAST, Classifier, Relationship } from './ast.js';
import { makeClassifier, registerInNamespace } from './class-namespace.js';
import { CLASS_ID, stripQuotes } from './class-relationship-parser.js';

/** Fixed circle diameter (px, pre-/72 inch conversion) — matches upstream's
 *  `EntityImageLollipopInterface.SIZE = 10`; the node is never text-measured. */
export const LOLLIPOP_SIZE = 10;

/**
 * Fixed circle diameter (px, pre-/72 inch conversion) for an
 * association-class-couple "point" entity (`(A,B) .. C`) — matches
 * upstream's `EntityImageAssociationPoint.SIZE = 4`; the node is never
 * text-measured (G2 N8, `class-assoc-couple.ts`'s `kind: 'assoc-circle'`
 * classifiers). Lives alongside {@link LOLLIPOP_SIZE} (both are
 * fixed-diameter, non-text-measured dot-graph node sizes reused by
 * `class-dot-graph.ts`'s node-sizing AND `renderer.ts`'s draw radius) rather
 * than in `class-assoc-couple.ts` itself, to avoid a cycle: that module
 * already needs `class-dot-graph.ts#EDGE_DECORATION_MAP` for the couple's
 * class-link decor (G2 N8), and `class-dot-graph.ts` needs this constant.
 */
export const ASSOC_POINT_SIZE = 4;

// Regex groups (1-based; both endpoint alternatives are mutually exclusive —
// exactly one of groups 4/5 or 6/7 is defined per match):
//   1  HEADER weight (optional `@N.N` prefix)
//   2  ENT1 (identifier or "quoted")
//   3  FIRST_LABEL (quoted, spatially adjacent to ENT1)
//   4  LOL_THEN_ENT parens ("()"/"(("/"))")   5  LOL_THEN_ENT dashes
//   6  ENT_THEN_LOL dashes                     7  ENT_THEN_LOL parens
//   8  SECOND_LABEL (quoted, spatially adjacent to ENT2)
//   9  ENT2 (identifier or "quoted")
//   10 LABEL_LINK (free text after `:`)
// A trailing `<<stereotype>>` on either endpoint is accepted (matching the
// Java regex) but never consumed by executeArg upstream, so it is matched
// non-capturing and discarded here too.
export const LOLLIPOP_RE = new RegExp(
  String.raw`^(?:@([\d.]+)\s+)?` +
    String.raw`(${CLASS_ID})(?:\s*<<[^>]*>>)?` +
    String.raw`\s*(?:"([^"]+)")?` +
    String.raw`\s*(?:([()]\))([-=.]+)|([-=.]+)(\([()]))` +
    String.raw`\s*(?:"([^"]+)")?` +
    String.raw`\s*(${CLASS_ID})(?:\s*<<[^>]*>>)?` +
    String.raw`\s*(?::\s*(.+))?$`,
  'u',
);

/** `()`/`((`/`))` → half (required interface, socket) when doubled, else full
 *  (provided interface) — CommandLinkLollipop#getType. */
function lollipopKindOf(parens: string): 'full' | 'half' {
  return parens.charAt(0) === parens.charAt(1) ? 'half' : 'full';
}

/**
 * Count already-added relationships with length 1 that connect `normalEntityId`
 * to a lollipop-kind classifier — mirrors upstream
 * `AbstractClassOrObjectDiagram#getNbOfHozizontalLollipop`, used to bump a
 * third+ horizontal (same-rank) lollipop down a rank so it does not overlap.
 */
function countHorizontalLollipopLinks(ast: ClassDiagramAST, normalEntityId: string): number {
  const lollipopIds = new Set(
    ast.classifiers.filter((c) => c.kind === 'lollipop').map((c) => c.id),
  );
  let count = 0;
  for (const r of ast.relationships) {
    if (r.length !== 1) continue;
    const other = r.from === normalEntityId ? r.to : r.to === normalEntityId ? r.from : undefined;
    if (other !== undefined && lollipopIds.has(other)) count++;
  }
  return count;
}

/**
 * Create the new lollipop leaf classifier (never reused/deduped by id — every
 * `()--` line synthesises a fresh circle, even re-using the same display name
 * as an earlier one) and register it in the active namespace.
 *
 * Takes `ast`/`activeNamespace` directly rather than the parser's `ParseState`
 * (mirrors class-assoc-couple.ts's `ensure` callback pattern) so this module
 * does not depend on parser.ts — parser.ts depends on class-commands.ts, which
 * depends on this module, so a parser.ts import here would cycle.
 */
function createLollipopLeaf(
  ast: ClassDiagramAST,
  activeNamespace: string | null,
  name: string,
  kind: 'full' | 'half',
): string {
  const id = `__lol${ast.classifiers.filter((c) => c.kind === 'lollipop').length}`;
  const classifier = makeClassifier(id, 'lollipop', stripQuotes(name), activeNamespace);
  classifier.lollipopKind = kind;
  ast.classifiers.push(classifier);
  registerInNamespace(ast.namespaces, activeNamespace, id);
  return id;
}

interface LollipopMatch {
  isLolThenEnt: boolean;
  parens: string;
  dashes: string;
  lollipopName: string;
  existingName: string;
}

/** Untangle which side (ENT1 or ENT2) is the new lollipop vs the existing
 *  entity, and pull out the parens/dashes symbol pieces for whichever
 *  alternative (LOL_THEN_ENT vs ENT_THEN_LOL) actually matched. */
function resolveMatch(m: RegExpExecArray): LollipopMatch {
  const isLolThenEnt = m[4] !== undefined;
  const ent1Raw = m[2]!;
  const ent2Raw = m[9]!;
  return {
    isLolThenEnt,
    parens: isLolThenEnt ? m[4]! : m[7]!,
    dashes: isLolThenEnt ? m[5]! : m[6]!,
    lollipopName: isLolThenEnt ? ent1Raw : ent2Raw,
    existingName: isLolThenEnt ? ent2Raw : ent1Raw,
  };
}

/** dot minlen = length - 1 (class-dot-graph.ts); a lone horizontal (length 1)
 *  lollipop bumps to length 2 once a third one piles onto the same entity
 *  (upstream `getNbOfHozizontalLollipop(normalEntity) > 1`). */
function resolveLength(dashes: string, ast: ClassDiagramAST, existingId: string): number {
  const base = dashes.length;
  return base === 1 && countHorizontalLollipopLinks(ast, existingId) > 1 ? base + 1 : base;
}

/** Build the optional/omittable fields shared by both branches. */
function buildLinkExtras(
  firstLabel: string | undefined,
  secondLabel: string | undefined,
  labelLink: string | undefined,
  weight: string | undefined,
): Partial<Relationship> {
  const extras: Partial<Relationship> = {};
  if (firstLabel !== undefined) extras.fromMultiplicity = firstLabel;
  if (secondLabel !== undefined) extras.toMultiplicity = secondLabel;
  if (labelLink !== undefined && labelLink.trim() !== '') extras.label = labelLink.trim();
  if (weight !== undefined) extras.weight = Number(weight);
  return extras;
}

/**
 * Parse + apply one `Name ()-- Existing` / `Existing --() Name` line. Returns
 * false if the line does not match (leaving `ast` untouched). `ensure`
 * resolves/creates the "existing"-side classifier by name (the parser's
 * `ensureClassifier`), mirroring class-assoc-couple.ts's `applyAssocCouple`.
 *
 * The "existing" side must already be a declared classifier upstream
 * (`CommandLinkLollipop` errors "No class X" and drops the whole line
 * otherwise); this parser has no error-reporting channel for command
 * execution (no site here or elsewhere in class-commands.ts surfaces
 * diagnostics), so — consistent with every other relationship-endpoint site
 * in this parser (rule 6, REL_DISPATCH_RE) — it leniently auto-creates the
 * "existing" side instead of silently dropping the line.
 *
 * Does not update `lastEntity` (matches the pre-existing class-assoc-couple.ts
 * precedent for a synthesised connector leaf) — a `note left` with no
 * `of <Entity>` immediately after a `()--` line will not attach to the new
 * lollipop. Logged as a known gap, not fixed here (out of this task's scope).
 */
export function applyLollipop(
  ast: ClassDiagramAST,
  ensure: (id: string) => Classifier,
  activeNamespace: string | null,
  line: string,
): boolean {
  const m = LOLLIPOP_RE.exec(line);
  if (m === null) return false;

  const { isLolThenEnt, parens, dashes, lollipopName, existingName } = resolveMatch(m);
  const existing = ensure(existingName);
  const lollipopId = createLollipopLeaf(ast, activeNamespace, lollipopName, lollipopKindOf(parens));
  const length = resolveLength(dashes, ast, existing.id);
  const dashed = dashes.includes('.');

  // The lollipop link is never arrow-decorated at either end
  // (CommandLinkLollipop#getLinkType is hardcoded LinkDecor.NONE/NONE);
  // `dashed` alone (no override field for it — see layout.ts's
  // `dashed: decor.dashed`) picks a RelationshipType whose EDGE_DECORATION_MAP
  // entry is undashed/dashed respectively while sourceDecor/targetDecor:'none'
  // overrides that type's default decor (extension/hierarchical types are
  // avoided so the edge is never rank-swapped). cl1 (ENT1-side) is always
  // `from`, cl2 (ENT2-side) always `to`, regardless of which side is the
  // lollipop (CommandLinkLollipop always builds `new Link(..., cl1, cl2, ...)`).
  const rel: Relationship = {
    from: isLolThenEnt ? lollipopId : existing.id,
    to: isLolThenEnt ? existing.id : lollipopId,
    type: dashed ? 'usage' : 'association',
    sourceDecor: 'none',
    targetDecor: 'none',
    length,
    ...buildLinkExtras(m[3], m[8], m[10], m[1]),
  };
  ast.relationships.push(rel);
  return true;
}
