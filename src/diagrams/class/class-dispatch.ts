/**
 * Class-vs-description routing discriminator (mission A3).
 *
 * Mission A3 makes the class engine own the descriptive elements upstream's
 * `ClassDiagramFactory` owns. Per the mission's "route + render each tier
 * together" structure (decision-journal.md), this module grows one delta per
 * batch, alongside the rendering support for the elements that delta routes in —
 * never routing a fixture into the class engine before the engine can render it.
 *
 * The base behaviour mirrors upstream's factory-selection outcome: the class
 * factory (tried before the description factory) claims a block of native class
 * constructs, and the description factory claims a pure descriptive block. Our
 * `accepts()` approximates this by declining any block carrying a descriptive
 * signal that the class factory would not parse.
 *
 * Implemented as class-local logic. Per ADR-1 this must NOT mutate the shared
 * `descriptive-keywords.ts` (the sequence and description guards also consume
 * it); it only *reads* `hasDescriptiveSignal`.
 *
 * Batch 1 delta (Δ2 — note-body stripping): a shorthand token inside a block
 * note body (e.g. `(palegreen)` in a `note left of X … end note`) must not read
 * as a `(usecase)` descriptive element and misroute a genuine class diagram to
 * the description engine (fixture taxemo-34).
 *
 * Batch 1b delta (Δ3 — member-line stripping): a class NAMED like a descriptive
 * keyword, declared with member lines (`Person : guid OID`), starts with the
 * token `person` and would trip the descriptive signal. A member line (`Id :
 * …`) is never a descriptive element declaration, so it is excluded from the
 * scan. Pairs with the leading-dot edge fix that renders the namespace fixtures.
 *
 * Later batches add the native keyword / container / allow_mixing deltas with
 * their rendering support.
 */

import { hasDescriptiveSignal } from '../../core/descriptive-keywords.js';
import { REL_DISPATCH_RE } from './class-relationship-parser.js';

/**
 * Patterns that appear in class diagrams. Tested against the first
 * {@link SCAN_LINE_LIMIT} lines of a block (the block extractor's probe window).
 */
const CLASS_ACCEPTS_PATTERNS: readonly RegExp[] = [
  /^class\s/i,
  /^abstract\s+class\s/i,
  /^interface\s/i,
  /^enum\s/i,
  /^annotation\s/i,
  /<\|--|<\|\.\.|--\|>|\.\.\|>|\*--|o--|--\*|--o/,
];

/** Leading-line probe window, matching the block extractor and `hasDescriptiveSignal`. */
const SCAN_LINE_LIMIT = 20;

/**
 * Δ3 — a class member line, e.g. `Person : guid OID`. Excluded from the
 * descriptive scan so a class *named* after a descriptive keyword is not mistaken
 * for a `person`/`entity`/… descriptive element declaration.
 */
const MEMBER_LINE_RE = /^\w[\w".]*\s*:\s+\S/;

/**
 * Δ4 (scoped) — an `entity`/`circle` declaration. These are native class-factory
 * keywords (upstream `CommandCreateClass` / `CommandCreateEntityObjectMultilines`)
 * that the class engine now renders, so they are excluded from the descriptive
 * *decline* signal. They are deliberately NOT added to the *accept* signal: a
 * block routes to class on entity/circle only when it ALSO carries a class-forcing
 * keyword (`class`/`interface`/`enum`/`annotation`/`abstract` or a class-only
 * relationship — {@link CLASS_ACCEPTS_PATTERNS}). This lands the class+entity
 * fixtures (lilura/tepazu/xidura/niduni) without stealing a pure `entity`-as-
 * sequence-participant diagram (`entity Alice` + `Alice -> Bob`, no class keyword),
 * mirroring upstream's Sequence→Class factory order for that ambiguous case.
 */
const ENTITY_CIRCLE_DECL_RE = /^(?:entity|circle)\s+\S/i;

/** `allowmixing` / `allow_mixing` — a class-only directive. */
const ALLOW_MIXING_RE = /^allow_?mixing\b/i;

/**
 * Descriptive leaf keywords the class engine renders as a rect but which upstream
 * gates on `allowmixing` (`CommandCreateElementFull2`). Excluded from the decline
 * signal ONLY when `allowmixing` is present, so a `class`+`database` block under
 * allowmixing (givofi/popesa) routes to class via its class keyword, while a
 * plain `class C` + `database X` (no allowmixing) still stays with description —
 * matching upstream, which errors on the descriptive leaf without allowmixing.
 * `usecase`/`actor` are intentionally absent (their shapes are not yet rendered),
 * so `allowmixing`+`usecase` blocks (cacoma) stay in description until Tier 4.
 */
const DESCRIPTIVE_LEAF_DECL_RE = /^database\s+\S/i;

/**
 * Δ4b — a descriptive keyword opening a container (`rectangle X {`, `stack a {`,
 * `component b {`). These are native class-factory containers
 * (CommandPackageWithUSymbol, no allowmixing), so they are excluded from the
 * decline signal: a container block with an inner `class` (rakuci/xenere/lojiga)
 * routes to class via its class keyword. A pure descriptive container tree with
 * no class content still has no accept signal and stays with description.
 */
const CONTAINER_OPEN_RE =
  /^(?:package|rectangle|node|component|folder|frame|cloud|database|storage|artifact|file|card|queue|stack|hexagon|agent)\b.*\{\s*$/i;

const NOTE_BLOCK_START_RE = /^note\s+(?:left|right|top|bottom|over)\b/i;
/** ` : ` (spaces both sides) marks an *inline* single-line note, which has no body. */
const NOTE_INLINE_SEP_RE = /\s:\s/;
const NOTE_BLOCK_END_RE = /^end\s*note\b/i;

/**
 * Δ2 — drop the bodies of block notes (`note left of X` … `end note`) so
 * shorthand tokens inside a note body are not mistaken for a descriptive
 * element. An inline single-line note (`note left of X : text`) has no body and
 * is kept. A `::member` qualifier on the target does not defeat the start match
 * (only a spaced ` : ` inline separator does).
 */
function stripNoteBodies(lines: readonly string[]): string[] {
  const out: string[] = [];
  let inNote = false;
  for (const line of lines) {
    const t = line.trim();
    if (inNote) {
      if (NOTE_BLOCK_END_RE.test(t)) inNote = false;
      continue;
    }
    if (NOTE_BLOCK_START_RE.test(t) && !NOTE_INLINE_SEP_RE.test(t)) {
      inNote = true;
      continue;
    }
    out.push(line);
  }
  return out;
}

/**
 * True when the class engine should own this block.
 *
 * Decline any block carrying a descriptive signal the class factory would not
 * parse (pure descriptive → description). Relationship lines and block-note
 * bodies are removed first: a class NAMED like a descriptive keyword used as a
 * relationship endpoint, and a shorthand inside a note body, are not descriptive
 * element declarations.
 */
export function classAccepts(lines: readonly string[]): boolean {
  const allowMixing = lines.some((l) => ALLOW_MIXING_RE.test(l.trim()));
  // Δ1 — `allowmixing` is a class-only command: the block IS a class diagram
  // permitting descriptive elements (upstream CommandAllowMixing → ClassDiagram).
  if (allowMixing) return true;
  const declLines = stripNoteBodies(
    lines.filter((l) => !REL_DISPATCH_RE.test(l.trim())),
  ).filter((l) => {
    const t = l.trim();
    if (MEMBER_LINE_RE.test(t) || ENTITY_CIRCLE_DECL_RE.test(t)) return false;
    if (CONTAINER_OPEN_RE.test(t)) return false;
    if (allowMixing && DESCRIPTIVE_LEAF_DECL_RE.test(t)) return false;
    return true;
  });
  if (hasDescriptiveSignal(declLines)) return false;
  return lines
    .slice(0, SCAN_LINE_LIMIT)
    .some((l) => CLASS_ACCEPTS_PATTERNS.some((p) => p.test(l)));
}
