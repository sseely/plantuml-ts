/**
 * Fission — word-wrap. Splits one physical creole line's already-built
 * `CreoleAtom` sequence into MULTIPLE sub-lines so that no sub-line's total
 * width exceeds `maxWidth`.
 *
 * Upstream: `klimt/creole/Fission.java` + `Neutron.java`/`NeutronType.java`
 * (the word-boundary scan + greedy line-packing algorithm) + `legacy/
 * AtomText.java#getNeutrons`/`#manageSpecialChars`-adjacent `getNeutrons`
 * (the per-atom word-splitting) + `atom/AbstractAtom.java#getNeutrons`
 * (default: one indivisible `UNKNOWN`-type neutron for a non-text atom).
 * Ported onto this port's plain-data `CreoleAtom[]` representation (see
 * `atom/Atom.ts`'s doc comment) rather than as an OOP `Atom`/`Stripe`
 * hierarchy — `getSplitted`'s `Stripe`/`Atom` inputs/outputs become
 * `CreoleAtom[]` in / `CreoleAtom[][]` out; `noHeader()`/`blank(header)`
 * collapse to a no-op (L1 never builds `Stripe#getLHeader()` bullet-list
 * atoms — `Stripe.ts`'s doc comment).
 *
 * Trigger (E2r/L3): `style.wrapWidth()`'s callers (`svek/image/
 * EntityImageDescription.java`'s `desc`, `svek/image/EntityImageNote.java`'s
 * `textBlock`) — the `wrapWidth` skinparam (`FromSkinparamToStyle.java:250`,
 * `PName.MaximumWidth`; also reachable via `wrap_width`, normalised the
 * same as upstream's own `cleanForKeySlow`). Jar-verified 2026-07-15
 * (direct probe, a genuinely long single line,
 * `-DPLANTUML_DETERMINISTIC_TEXT=true`): upstream sets NO built-in
 * DEFAULT for `PName.MaximumWidth` anywhere (a full-tree grep of `net/`
 * confirms no default-style resource or Java constant ever populates
 * it) — a rectangle with a 137-char single-line display and no
 * `skinparam wrapWidth` renders as ONE unwrapped `<text>`
 * (`textLength="720.3875"`); the SAME source with `skinparam wrapWidth 100`
 * splits into per-word `<text>` runs even at positions that never
 * actually wrap (`Fission#getSplitted` unconditionally decomposes into
 * Neutrons and reconstructs once `maxWidth != 0`, regardless of whether
 * any BREAK occurs — jar-verified byte-for-byte, see below).
 *
 * Corpus reach (corrected 2026-07-15 — an EARLIER version of this
 * comment claimed zero corpus reach, based on grepping only the literal
 * strings `wrapwidth`/`maximumwidth`; that was WRONG — it missed the
 * underscore-normalised `wrap_width` form AND, far more consequentially,
 * `assets/stdlib/awslib{10,14,20}/AWSCommon.puml` — EVERY AWS-icon
 * fixture's own `!include`-pulled-in file — sets `skinparam wrapWidth
 * 200` at its own top level. 5 census fixtures reach it:
 * `component/mejoxi-96-cegu294` (direct `skinparam wrapWidth 200`),
 * `usecase/{kovaxi-11-reti348,zidebi-71-nocu387}` (`skinparam wrap_width
 * 150`), `usecase/{fariba-82-xolu802,kofuca-08-pafi749}` (via the AWS
 * `!include`). Jar-verified against `usecase/fariba-82-xolu802`'s own
 * cached oracle SVG: its `User(user, "Trusted user", "")`-macro-expanded
 * entity's `==Trusted user` heading (85.3px wide, nowhere near the 200px
 * limit — never actually wraps) STILL renders as 3 separate `<text>`
 * runs ("Trusted"/" "/"user", textLength 54.2/4.4/31.1) in the JAR'S OWN
 * oracle SVG — byte-identical textLength to what this port's `getSplitted`
 * now produces, confirming the "always decompose, even with no visible
 * break" behavior above is faithful, not a bug. Measured impact: all 3
 * affected fixtures with a content-level difference (mejoxi, fariba,
 * kofuca) moved to a HIGHER raw diff count post-cutover (a `svg/g/g
 * [childCount]` structural mismatch → match, unmasking pre-existing,
 * unrelated, out-of-scope leaf-sizing/positioning diffs underneath —
 * the SAME masking-artifact pattern as L2's own "unmasking" findings,
 * `plans/e2r-creole/ledger.md`'s L2 section) — not a regression in this
 * mechanism itself. `kovaxi-11-reti348`/`zidebi-71-nocu387` (the 2
 * `wrap_width` fixtures) show no diff-count change (their content never
 * reaches a `<size:>`/`<color:>`/heading composite that exposes new
 * geometry). Full detail: `plans/e2r-creole/ledger.md`'s L3 section.
 *
 * DOT-frozen-gate CAUTION boundary: this module is wired into the RENDER
 * path only (`EntityImageDescriptionSupport.ts#buildTextBlock`);
 * `leaf-sizing.ts` (the DOT-layout node-sizing path) stays byte-untouched
 * this iteration, same as L1's own decision for the rest of the creole
 * engine — verified via `git diff --name-only` (no `layout.ts`/
 * `leaf-sizing.ts` in this iteration's write-set) and a full `npx tsx
 * scripts/dot-sync-report.ts component usecase class object state` run
 * AFTER this module landed: component 262/262, usecase 90/90, class
 * 708/708, object 78/80, state 267/267 — EXACTLY the frozen baseline,
 * unchanged, even though `component/mejoxi-96-cegu294` (a DOT-frozen
 * `component` fixture) now word-wraps and its own `svg/@height`
 * improved — proving the DOT layer and the render layer are provably
 * independent for this mechanism, not just by construction.
 */
import type { CreoleAtom } from './atom/Atom.js';
import type { FontConfiguration } from '../shape/UText.js';

/** Upstream: `klimt/creole/NeutronType.java` (`enum`). As-const string
 *  union per project convention (no `const enum`). */
export type NeutronType = 'UNBREAKABLE' | 'WHITESPACE' | 'CJK_IDEOGRAPH' | 'ZWSP_SEPARATOR' | 'UNKNOWN';

/** Upstream: `klimt/creole/Neutron.java`. `atom` is the (possibly
 *  substring-sliced, for a `'text'` run) `CreoleAtom` this neutron measures
 *  and eventually re-emits as output; `null` only for the `ZWSP_SEPARATOR`
 *  sentinel (upstream's `Neutron.ZWSP`, a singleton with `data=null,
 *  asAtom=null`). */
interface AtomNeutron {
  readonly type: NeutronType;
  readonly atom: CreoleAtom | null;
}

const ZWSP: AtomNeutron = { type: 'ZWSP_SEPARATOR', atom: null };

/** Upstream: `Neutron#getNeutronTypeFromChar`. Java's `Character
 *  .isWhitespace` excludes non-breaking spaces (U+00A0/U+2007/U+202F);
 *  JS's `\s` includes them — a known, low-risk divergence (no sampled
 *  corpus fixture's description text contains a non-breaking space). */
function neutronTypeFromChar(ch: string): NeutronType {
  if (/\s/.test(ch)) return 'WHITESPACE';
  if (isCjkOrJapanese(ch)) return 'CJK_IDEOGRAPH';
  return 'UNBREAKABLE';
}

/** Upstream: `Neutron#isCjkOrJapanese` (Kanji/Hiragana/Katakana/CJK
 *  punctuation/halfwidth-Katakana ranges) — same ranges, restructured as a
 *  table (not an if-chain) to keep this function's cyclomatic complexity
 *  under this project's lint ceiling. */
const CJK_RANGES: readonly (readonly [number, number])[] = [
  [0x4e00, 0x9fff],
  [0x3040, 0x309f],
  [0x30a0, 0x30ff],
  [0x3000, 0x303f],
  [0xff65, 0xff9f],
];

function isCjkOrJapanese(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return CJK_RANGES.some(([lo, hi]) => code >= lo && code <= hi);
}

/** Upstream: `AtomText#getNeutrons` (char-by-char run scan; a
 *  `CJK_IDEOGRAPH`-typed run is flushed after EVERY char, i.e. never
 *  grouped) + `addPending` (a `WHITESPACE`/`CJK_IDEOGRAPH` run gets a
 *  `ZWSP_SEPARATOR` on both sides — the allowed break points). Non-text
 *  atoms (`'inline'`/`'latex'`) fall through to `AbstractAtom#getNeutrons`'s
 *  default: one indivisible `UNKNOWN`-type neutron, no surrounding ZWSPs
 *  (never a forced break point around an image/sprite/latex atom). */
function getNeutronsForAtom(atom: CreoleAtom): AtomNeutron[] {
  if (atom.kind !== 'text') return [{ type: 'UNKNOWN', atom }];
  const text = atom.text;
  if (text.length === 0) return [];
  const result: AtomNeutron[] = [];
  let pendingStart = 0;
  let pendingType = neutronTypeFromChar(text[0] as string);
  for (let i = 1; i < text.length; i++) {
    const currentType = neutronTypeFromChar(text[i] as string);
    if (pendingType !== currentType || pendingType === 'CJK_IDEOGRAPH') {
      pushTextNeutron(result, text.slice(pendingStart, i), pendingType, atom.font);
      pendingStart = i;
      pendingType = currentType;
    }
  }
  pushTextNeutron(result, text.slice(pendingStart), pendingType, atom.font);
  return result;
}

function pushTextNeutron(result: AtomNeutron[], piece: string, type: NeutronType, font: FontConfiguration): void {
  const subAtom: CreoleAtom = { kind: 'text', text: piece, font };
  const isBreakable = type === 'WHITESPACE' || type === 'CJK_IDEOGRAPH';
  if (isBreakable) result.push(ZWSP);
  result.push({ type, atom: subAtom });
  if (isBreakable) result.push(ZWSP);
}

/** Upstream: `Fission.StripeSimpleInternal` (no `header`/`removeInitialSpaces`
 *  ctor params here — L1 never builds a bullet-list header atom, so every
 *  line behaves as upstream's `header == null` case). `width` is a plain
 *  running sum (upstream's `-1` "sealed, never re-read" sentinel isn't
 *  needed: this port never calls `.width` again after a line is sealed). */
interface WrapLineBuilder {
  readonly neutrons: AtomNeutron[];
  width: number;
  /** `true` for every line EXCEPT the first (upstream: `new
   *  StripeSimpleInternal(true, ...)` on every break). */
  readonly removeInitialSpaces: boolean;
}

function newLine(removeInitialSpaces: boolean): WrapLineBuilder {
  return { neutrons: [], width: 0, removeInitialSpaces };
}

/** Upstream: `StripeSimpleInternal#addNeutron`. */
function addNeutron(line: WrapLineBuilder, n: AtomNeutron, measureAtomWidth: (atom: CreoleAtom) => number): void {
  const last = line.neutrons[line.neutrons.length - 1];
  if (n.type === 'ZWSP_SEPARATOR' && line.neutrons.length === 0) return;
  if (n.type === 'ZWSP_SEPARATOR' && last !== undefined && last.type === 'ZWSP_SEPARATOR') return;
  if (line.removeInitialSpaces && line.neutrons.length === 0 && n.type === 'WHITESPACE') return;
  line.neutrons.push(n);
  line.width += n.type === 'ZWSP_SEPARATOR' ? 0 : measureAtomWidth(n.atom as CreoleAtom);
}

/** Upstream: `StripeSimpleInternal#slightyShorten`. Finds the LAST
 *  `ZWSP_SEPARATOR` in the line; if none exists (a single unbreakable run
 *  already exceeds `maxWidth` with no break point inside it), returns
 *  `[]` — upstream's own escape hatch for an unbreakably-long word (the
 *  line is kept, over-width, as-is; see this module's doc comment on the
 *  main loop for why this can't infinite-loop). */
function slightyShorten(line: WrapLineBuilder, measureAtomWidth: (atom: CreoleAtom) => number): AtomNeutron[] {
  let lastZwsp = -1;
  for (let i = line.neutrons.length - 1; i >= 0; i--) {
    if (line.neutrons[i]?.type === 'ZWSP_SEPARATOR') {
      lastZwsp = i;
      break;
    }
  }
  if (lastZwsp === -1) return [];
  const removed = line.neutrons.splice(lastZwsp);
  for (const rn of removed) line.width -= rn.type === 'ZWSP_SEPARATOR' ? 0 : measureAtomWidth(rn.atom as CreoleAtom);
  return removed;
}

/** Upstream: `StripeSimpleInternal#isWhite`. */
function isWhite(line: WrapLineBuilder): boolean {
  return line.neutrons.every((n) => n.type === 'ZWSP_SEPARATOR' || n.type === 'WHITESPACE');
}

/** Upstream: `StripeSimpleInternal#removeFinalSpaces`. */
function removeFinalSpaces(line: WrapLineBuilder): void {
  while (line.neutrons.length > 0 && line.neutrons[0]?.type === 'ZWSP_SEPARATOR') line.neutrons.shift();
  while (line.neutrons.length > 1) {
    const last = line.neutrons[line.neutrons.length - 1];
    if (last === undefined || (last.type !== 'WHITESPACE' && last.type !== 'ZWSP_SEPARATOR')) break;
    line.neutrons.pop();
  }
}

/** Upstream: `StripeSimpleInternal#getAtoms` (excludes ZWSPs; a SECOND,
 *  belt-and-suspenders leading-whitespace drop on `removeInitialSpaces`
 *  lines, independent of `addNeutron`'s own leading-whitespace guard). */
function neutronsToAtoms(line: WrapLineBuilder): CreoleAtom[] {
  const out: CreoleAtom[] = [];
  for (const n of line.neutrons) {
    if (n.type === 'ZWSP_SEPARATOR') continue;
    if (line.removeInitialSpaces && out.length === 0 && n.type === 'WHITESPACE') continue;
    out.push(n.atom as CreoleAtom);
  }
  return out;
}

/**
 * Upstream: `Fission#getSplitted`. `atoms` is one physical (pre-wrap) line's
 * already-built `CreoleAtom` sequence (`StripeSimple.ts#buildStripeAtoms`/
 * `buildLiteralAtoms`'s output); `maxWidth` is `style.wrapWidth()`'s
 * `LineBreakStrategy#getMaxWidth()` (0 = disabled — see this module's doc
 * comment); `measureAtomWidth` is the caller's own per-atom width function
 * (text atoms: font-aware `stringBounder` measurement; resolved `<img>`/
 * `<$sprite>`/`<latex>` atoms: their own resolved width) — mirrors
 * `Neutron#getWidth(StringBounder)`.
 */
export function getSplitted(
  atoms: readonly CreoleAtom[],
  maxWidth: number,
  measureAtomWidth: (atom: CreoleAtom) => number,
): readonly (readonly CreoleAtom[])[] {
  const valueMaxWidth = Math.abs(maxWidth);
  if (valueMaxWidth === 0) return [atoms];

  const deque: AtomNeutron[] = [];
  for (const atom of atoms) deque.push(...getNeutronsForAtom(atom));
  if (deque.length === 0 || deque[deque.length - 1]?.type !== 'ZWSP_SEPARATOR') deque.push(ZWSP);

  const result: WrapLineBuilder[] = [newLine(false)];
  let line = result[0] as WrapLineBuilder;

  while (deque.length > 0) {
    const current = deque.shift() as AtomNeutron;
    if (current.type === 'ZWSP_SEPARATOR' && line.width > valueMaxWidth) {
      deque.unshift(current);
      const removed = slightyShorten(line, measureAtomWidth);
      for (let i = removed.length - 1; i >= 0; i--) deque.unshift(removed[i] as AtomNeutron);
      line = newLine(true);
      result.push(line);
    } else {
      addNeutron(line, current, measureAtomWidth);
    }
  }

  for (const l of result) removeFinalSpaces(l);
  while (result.length > 1 && isWhite(result[result.length - 1] as WrapLineBuilder)) result.pop();

  return result.map((l) => neutronsToAtoms(l));
}
