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
  const declLines = stripNoteBodies(
    lines.filter((l) => !REL_DISPATCH_RE.test(l.trim())),
  ).filter(
    (l) =>
      !MEMBER_LINE_RE.test(l.trim()) && !ENTITY_CIRCLE_DECL_RE.test(l.trim()),
  );
  if (hasDescriptiveSignal(declLines)) return false;
  return lines
    .slice(0, SCAN_LINE_LIMIT)
    .some((l) => CLASS_ACCEPTS_PATTERNS.some((p) => p.test(l)));
}
