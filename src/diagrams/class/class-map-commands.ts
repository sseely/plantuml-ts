/**
 * `map` declaration command for the class diagram parser (mission
 * object-dot-sync T3 — `CommandCreateMap` + `BodierMap`).
 *
 * Upstream has no separate map/object-diagram engine (see
 * class-object-commands.ts's file doc for the same point about `object`):
 * `ClassDiagramFactory` registers `CommandCreateMap` directly alongside the
 * class commands. `map` is ALWAYS multi-line — upstream has no single-line
 * map command (`CommandCreateMap extends CommandMultilines2`, no sibling
 * single-line class) — so, unlike `object`, there is only one opener here.
 *
 * Body lines (`key => value` / `key *-> dest`) are collected via
 * `parser.ts#pendingBodyId`, the same mechanism `class X { ... }` and
 * `object Foo { ... }` bodies use, but routed to {@link applyMapBodyLine}
 * (parser.ts#handlePendingBodyLine dispatches by the target classifier's
 * `kind`) instead of `parseMemberLine`/`parseObjectField` — a map row is a
 * `MapRow` (ast.ts), not a `Member`.
 *
 * Split into its own module (mirrors class-object-commands.ts's own split
 * from class-commands.ts) to keep both files under the repo's
 * 500-line-per-file cap.
 *
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateMap.java
 * @see ~/git/plantuml/.../cucadiagram/BodierMap.java
 * @see ~/git/plantuml/.../objectdiagram/ClassDiagramFactory.java (registration)
 */

import type { Classifier, MapRow, Relationship } from './ast.js';
import {
  countByName,
  firstWithName,
  qualifiedId,
  resolveReference,
  splitOnSeparator,
} from './class-namespace.js';
import { ensureClassifier, type ParseState } from './parser.js';

// ---------------------------------------------------------------------------
// Header grammar (CommandCreateMap.getRegexConcat())
// ---------------------------------------------------------------------------

/**
 * Upstream NAME = `(?:[%g]([^%g]+)[%g][%s]+as[%s]+)?([%pLN_.]+)` — UNLIKE
 * `object`'s four-alternative `nameAndCode()` (class-object-commands.ts),
 * this is only the quoted-display-then-`as`-code order; there is no
 * code-as-quoted-display reverse form and no bare-quoted-code-only form.
 * `[%pLN_.]+` (Unicode letter/digit/underscore/dot) is approximated as
 * `[\w.]+`, mirroring CLASS_ID's own ASCII-`\w` approximation
 * (class-relationship-parser.ts) rather than requiring the regex `u` flag.
 * Capture groups: 1 DISPLAY (optional), 2 CODE (mandatory).
 */
const NAME = '(?:"([^"]*)"\\s+as\\s+)?([\\w.]+)';

/** `StereotypePattern.optional("STEREO")` — `<< stereotype >>`. Duplicated
 *  from class-object-commands.ts (not imported — that file's write-set is
 *  outside this task's, and both already duplicate this fragment from
 *  class-declaration-parser.ts's `COLOR_RE`-adjacent grammar). */
const STEREO = '(?:\\s*<<\\s*([^<>]+?)\\s*>>)?';

/** `UrlBuilder.OPTIONAL` — matched and discarded, like the object opener's
 *  URL group (`Classifier` has no `url` field). */
const URL = '(?:\\s*\\[\\[[^\\]]*\\]\\])?';

/**
 * `ColorParser.simpleColor(ColorType.BACK)` — the SAME `COLORS_REGEXP`
 * grammar (PART2 multi-attribute form, or a bare `#colorname`) as
 * class-object-commands.ts's `COLOR` / class-declaration-parser.ts's
 * `COLOR_RE`. Duplicated rather than imported for the same reason as STEREO.
 * @see ~/git/plantuml/.../klimt/color/ColorParser.java:43-46,70-71
 */
const COLOR =
  '(#(?:\\w+[-\\\\|/]?\\w+;)?(?:(?:text|back|header|line|line\\.dashed|' +
  'line\\.dotted|line\\.bold|shadowing)(?::\\w+[-\\\\|/]?\\w+)?' +
  '(?:;|(?![\\w;:.])))+|#\\w+[-\\\\|/]?\\w+)?';

/**
 * Trailing `##[dotted|dashed|bold]?colorname?` line-color spec — a SEPARATE
 * optional grammar group from COLOR above, captured whole (raw) rather than
 * split into style/color sub-groups: this port has no rendering consumer for
 * a map's line color yet (T4), so there is nothing to gain from splitting it
 * the way class-declaration-parser.ts's `LINECOLOR_RE` does for the
 * class-declaration `color` field, which this reuses the SAME combined
 * "COLOR LINECOLOR" concat convention for (see {@link parseMapMatch}).
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateMap.java:95
 */
const LINECOLOR = '(##(?:\\[(?:dotted|dashed|bold)\\])?\\w*)?';

/**
 * `map <name-and-code> [<<stereo>>] [[[url]]] [#color] [##linecolor] {` — the
 * trailing `{` is MANDATORY (upstream `RegexLeaf("\\{")` then
 * `RegexLeaf.end()`, no optional-brace alternative like `object` has).
 * Capture groups: 1-2 NAME, 3 STEREO, 4 COLOR, 5 LINECOLOR.
 */
export const MAP_MULTILINE_DECL_RE = new RegExp(
  '^map\\s+' + NAME + STEREO + URL + '\\s*' + COLOR + '\\s*' + LINECOLOR + '\\s*\\{\\s*$',
  'i',
);

/**
 * Bare `map Name` (NO trailing `{`) — upstream this form is NOT
 * CommandCreateMap (whose start regex mandates the brace) but a TYPE
 * alternative of CommandCreateClass itself (CommandCreateClass.java:87:
 * `...|dataclass|record|map`), routed through `LeafType.getLeafType` to an
 * empty MAP leaf. Implemented here as a sibling entry (tried AFTER the
 * multiline opener, so the `{` form always wins) instead of extending
 * DECL_KIND_RE: the classifier-declaration rule runs BEFORE MAP_COMMANDS in
 * the dispatch table, so teaching IT the `map` keyword would steal
 * `map X {` from the multiline opener and mis-parse map bodies as class
 * members. Observable ordering matches upstream (Multilines at
 * initCommandsList:117 before CommandCreateClass at :120).
 * Same capture groups as the multiline form.
 */
export const MAP_BARE_DECL_RE = new RegExp(
  '^map\\s+' + NAME + STEREO + URL + '\\s*' + COLOR + '\\s*' + LINECOLOR + '\\s*$',
  'i',
);

interface Command {
  pattern: RegExp;
  execute(state: ParseState, match: RegExpExecArray): void;
}

interface MapMatch {
  rawCode: string;
  rawDisplay: string | undefined;
  stereotype: string | undefined;
  color: string | undefined;
}

/**
 * Pull id/display/stereotype/color out of a matched {@link
 * MAP_MULTILINE_DECL_RE} line. `color` combines the COLOR and LINECOLOR
 * groups with the same "COLOR LINECOLOR" space-joined convention
 * class-declaration-parser.ts's `extractDecorations` uses when both a
 * `#color` and a `##linecolor` are present on one declaration.
 */
function parseMapMatch(match: RegExpExecArray): MapMatch {
  const colorGroup = match[4];
  const lineColorGroup = match[5];
  const color =
    colorGroup !== undefined && lineColorGroup !== undefined
      ? `${colorGroup} ${lineColorGroup}`
      : (colorGroup ?? lineColorGroup);
  return {
    rawCode: match[2]!,
    rawDisplay: match[1],
    stereotype: match[3]?.trim(),
    color,
  };
}

/**
 * Open a `map Name { ... }` body (`CommandCreateMap#executeArg0` +
 * `executeNow`'s header handling).
 *
 * `quarkInContext(true, ...)` (`reuseExistingChild=true`, matching
 * `object`'s declaration site — see class-object-commands.ts's
 * `applyObjectDecl` doc) resolves the quark; `quark.getData() != null` (an
 * ALREADY-declared entity, of ANY kind, at that resolved id — matching
 * upstream's Entity-level check, not a map-only one) then fails the whole
 * command ("Map already exists" — `executeArg0` returns null,
 * `executeNow` errors before ever reading a body line). This parser has no
 * error-reporting channel for command execution (same gap as `object`'s
 * duplicate no-op), so the observable behavior is: the existing entity is
 * left completely untouched, AND — unlike `object`'s single-line duplicate,
 * which has no body to worry about — the map's `{ ... }` body must still be
 * consumed so its lines do not leak to `dispatchCommand` as bogus top-level
 * commands (upstream: `executeNow` always operates on the WHOLE matched
 * multi-line block; the null check happens after the block is already
 * extracted). `state.pendingBodyId` is set to `''` — a sentinel no real
 * classifier can ever have as its id (every declaration grammar's CODE/NAME
 * charset requires at least one character) — so
 * `parser.ts#handlePendingBodyLine`'s `classifierIndex.get('')` lookup
 * always misses and every body line up to the closing `}` is silently
 * discarded without touching any classifier's `rows`.
 */
function applyMapOpen(state: ParseState, match: RegExpExecArray): void {
  const { rawCode, rawDisplay, stereotype, color } = parseMapMatch(match);

  const { id } = resolveReference({
    namespaces: state.ast.namespaces,
    sep: state.namespaceSeparator,
    activeNamespace: state.activeNamespace,
    name: rawCode,
    display: rawDisplay,
    intermediatePackages: state.intermediatePackages,
    classifiers: state.ast.classifiers,
    reuseExistingChild: true,
  });
  if (state.classifierIndex.has(id)) {
    state.pendingBodyId = ''; // "Map already exists" — consume-and-discard the body
    return;
  }

  const classifier = ensureClassifier(state, rawCode, 'map', rawDisplay, true);
  if (stereotype !== undefined) classifier.stereotype = stereotype;
  if (color !== undefined) classifier.color = color;
  state.pendingBodyId = classifier.id;
}

/**
 * Bare `map Name` declaration (CommandCreateClass TYPE=map → empty MAP
 * leaf). Duplicate-name behavior follows CommandCreateClass, i.e. the
 * class-declaration path (existing entity reused, header decorations
 * re-applied), NOT CommandCreateMap's hard "already exists" error — there
 * is no body to consume, so no sentinel is needed.
 * @see ~/git/plantuml/.../classdiagram/command/CommandCreateClass.java:87,171
 */
function applyBareMapDecl(state: ParseState, match: RegExpExecArray): void {
  const { rawCode, rawDisplay, stereotype, color } = parseMapMatch(match);
  const classifier = ensureClassifier(state, rawCode, 'map', rawDisplay, true);
  if (stereotype !== undefined) classifier.stereotype = stereotype;
  if (color !== undefined) classifier.color = color;
}

// ---------------------------------------------------------------------------
// Body line parsing (BodierMap.addFieldOrMethod + CommandCreateMap#executeNow)
// ---------------------------------------------------------------------------

/**
 * `BodierMap.p` — `(\*-+_?\>)`: the linked-entry arrow token. Upstream's
 * `getLinkedEntry` runs this same pattern independently for BOTH the row
 * decision (`addFieldOrMethod`) and the link decision (`executeNow`'s own
 * separate `getLinkedEntry(line)` call) — replicated here as one shared
 * regex rather than two copies, since both call sites need the exact same
 * match (`m.index`/`m[0]`), not just a boolean.
 */
const LINKED_ENTRY_RE = /(\*-+_?>)/;

/**
 * Compute the `MapRow` a body line contributes, mirroring
 * `BodierMap#addFieldOrMethod`'s two-branch `ok` decision: `=>` is checked
 * FIRST (a line containing both `=>` and a linked-entry token still takes
 * this branch — see {@link computeMapLink}'s doc for how the two diverge
 * on `key`), then the linked-entry pattern (row value = `''`, the port
 * `MapRow.linkedCode` is filled in by the caller once the link resolves).
 * Returns `null` for neither form ("Map definition should contains key =>
 * value" upstream — silently dropped here, matching this parser's existing
 * no-error-channel posture).
 */
function computeMapRow(line: string): MapRow | null {
  const eqIdx = line.indexOf('=>');
  if (eqIdx !== -1) {
    return { key: line.slice(0, eqIdx).trim(), value: line.slice(eqIdx + 2).trim() };
  }
  const linked = LINKED_ENTRY_RE.exec(line);
  if (linked !== null) {
    return { key: line.slice(0, linked.index).trim(), value: '' };
  }
  return null;
}

interface MapLink {
  key: string;
  dest: string;
  length: number;
}

/**
 * Compute the link a body line contributes, mirroring `executeNow`'s
 * INDEPENDENT `getLinkedEntry(line)` check — this runs regardless of which
 * branch {@link computeMapRow} took. `key` here is `line.substring(0, x)`
 * where `x = line.indexOf(linkStr)` on the WHOLE line: for a line with both
 * `=>` and a later `*->`, this `key` therefore includes the `key => value`
 * text up to the arrow token — a DIFFERENT (longer) string than the row's
 * own `key` from the `=>` branch. Replicated faithfully, not normalized —
 * this is upstream's actual (if surprising) behavior, not a bug to fix
 * silently (see this project's porting-discipline rule against inline
 * upstream-bug fixes).
 *
 * `length = linkStr.length - 2` (`*->` → 1, `*-->` → 2, …) drives the dot
 * `minlen` the same way `Relationship.length` does for an ordinary arrow
 * (class-relationship-parser.ts's `arrowLength`).
 */
function computeMapLink(line: string): MapLink | null {
  const linked = LINKED_ENTRY_RE.exec(line);
  if (linked === null) return null;
  const linkStr = linked[0];
  const x = line.indexOf(linkStr);
  return {
    key: line.slice(0, x).trim(),
    dest: line.slice(x + linkStr.length).trim(),
    length: linkStr.length - 2,
  };
}

/**
 * Read-only counterpart to `resolveReference`'s lookup rules, for the map
 * link's dest resolution — upstream's `quarkInContext(true, dest)` followed
 * immediately by `entity2 == null` bails without ever creating anything, so
 * this must NOT mutate `state.ast.namespaces` the way `resolveReference`'s
 * qualified-path fallback does (`ensureNamespaceChain` unconditionally
 * registers namespace entries for the resolved id, even when the caller only
 * wanted to check existence) — a namespace conjured for a dest that turns
 * out not to exist would later get promoted to a phantom leaf classifier by
 * `collapseEmptyNamespacesFinal` (class-namespace.ts). Mirrors the bare-name
 * unique-match shortcut (`tryReuseExisting`'s `countByName`/`firstWithName`
 * pair) for the common case, falling back to a plain qualified-id lookup
 * against the already-registered `classifierIndex` for a dotted reference —
 * a simplified (existence-check-only) subset of the full endpoint resolution
 * `class-relationship-parser.ts` performs for ordinary arrow endpoints,
 * sufficient here since a map link never AUTO-CREATES its destination.
 */
function resolveExistingId(state: ParseState, rawName: string): string | undefined {
  const sep = state.namespaceSeparator;
  if (
    splitOnSeparator(rawName, sep) === null &&
    countByName(state.ast.classifiers, sep, rawName) === 1
  ) {
    return firstWithName(state.ast.classifiers, sep, rawName)!.id;
  }
  const id = qualifiedId(rawName, state.activeNamespace, sep, state.ast.namespaces);
  return state.classifierIndex.has(id) ? id : undefined;
}

/**
 * Apply one `map { ... }` body line (parser.ts#handlePendingBodyLine, routed
 * here when the pending classifier's `kind` is `'map'`). Blank lines are
 * dropped (upstream: `lines.trim().removeEmptyLines()` runs on the WHOLE
 * block before `executeNow` iterates it) — an empty trimmed line matches
 * neither {@link computeMapRow} branch, so it is dropped by the same path as
 * any other unparseable line, with no special-case needed.
 *
 * A row and a link are computed independently (matching `executeNow`'s two
 * separate checks), but a link can only exist when {@link LINKED_ENTRY_RE}
 * matched — which is exactly one of {@link computeMapRow}'s two non-null
 * branches — so `row` is never `null` when `link` is non-null; no extra
 * guard is needed to replicate upstream's `ok` gate (it is structurally the
 * same condition here).
 *
 * A missing dest ("No such entity") skips ONLY the link — the row (if any)
 * from the SAME line is still appended, a deliberate silent-no-op divergence
 * from upstream's hard command error (documented per this parser's existing
 * no-error-channel posture; see {@link applyMapOpen}'s doc for the same
 * posture on a duplicate map name).
 */
export function applyMapBodyLine(state: ParseState, classifier: Classifier, rawLine: string): void {
  const line = rawLine.trim();
  const row = computeMapRow(line);
  const link = computeMapLink(line);
  if (link !== null) {
    const destId = resolveExistingId(state, link.dest);
    if (destId !== undefined) {
      if (row !== null) row.linkedCode = destId;
      const rel: Relationship = {
        from: classifier.id,
        to: destId,
        // LinkType(LinkDecor.ARROW, LinkDecor.NONE) — verified (via
        // CommandLinkClass#getLinkType/executeArg) to be EXACTLY the LinkType
        // a plain `entity1 -> entity2` relationship line produces: LinkType's
        // decor1 field holds the decor found near ENT2 (the arrow's target
        // head), decor2 holds the decor found near ENT1 (the source) — see
        // `getLinkType`'s `new LinkType(decors2, decors1)` swap. So this
        // reuses the same type/decor pair `resolveArrow('->')` /
        // `parseArrowDecors('->', false)` compute for a bare `->` token:
        // association, source undecorated, target open-arrowhead.
        type: 'association',
        sourceDecor: 'none',
        targetDecor: 'open',
        fromPort: link.key,
        length: link.length,
      };
      state.ast.relationships.push(rel);
    }
  }
  if (row !== null) {
    (classifier.rows ??= []).push(row);
  }
}

/**
 * Map commands, spread into `COMMANDS` (class-commands.ts) immediately after
 * `OBJECT_COMMANDS` — mirrors upstream `ClassDiagramFactory.initCommandsList`'s
 * registration order: `CommandCreateEntityObjectMultilines`(116) then
 * `CommandCreateMap`(117). The two openers never collide (`map` always
 * requires a trailing `{`; `object`'s multiline form does too, and both
 * require their own literal keyword first), so exact interleaving with
 * `OBJECT_COMMANDS`'s own two entries does not matter functionally — this is
 * placed as one array (not spliced between object's multiline/single-line
 * entries) to keep the class-commands.ts edit a single-line insertion.
 */
export const MAP_COMMANDS: readonly Command[] = [
  { pattern: MAP_MULTILINE_DECL_RE, execute: applyMapOpen },
  // Bare form second — the `{` opener above must win for `map X {`.
  { pattern: MAP_BARE_DECL_RE, execute: applyBareMapDecl },
];
