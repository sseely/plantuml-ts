/**
 * `matchSpriteCommand` — the shared sprite-DEFINITION matcher parsers call
 * at their own command-dispatch position, mirroring
 * `matchAnnotationCommand` (`core/annotations/commands.ts`) exactly:
 * extraction inside each parser, never a textual pre-pass, so a
 * `sprite`-shaped line inside a `note ... end note` block is never stolen
 * (decisions.md D3, same discipline).
 *
 * Grammar ports `CommandFactorySprite`'s two `RegexConcat` patterns
 * (`multiline` java :68-77, `singleLine` java :79-87) into hand-built
 * `RegExp`s. `%s`/`%pLN` translated per the established project idiom (see
 * `core/annotations/commands.ts`'s file doc for the same choices already
 * made elsewhere in this port): `%pLN_` (NAME's Unicode letter/digit/
 * underscore class) -> `\w` (ASCII word chars, the acknowledged divergence
 * already documented at that precedent site). All patterns are built from
 * string concatenation + `new RegExp(p, 'i')`, never a `/regex/` literal
 * containing `{`/`[`/`]` (a project complexity-hook desync risk for
 * literals with those characters, per project CLAUDE.md's hard rules).
 *
 * Dispatch: upstream registers `CommandFactorySprite` (via
 * `CommonCommands.addCommonCommands2`) immediately AFTER
 * `CommonCommands.addTitleCommands` in every diagram factory examined
 * (`ClassDiagramFactory.java:168-169`: addTitleCommands then
 * addCommonCommands2 directly; `StateDiagramFactory`/
 * `SequenceDiagramFactory`/`DescriptionDiagramFactory` all call
 * `addCommonCommands1`, which is defined as addTitleCommands THEN
 * addCommonCommands2 THEN addCommonScaleCommands THEN addCommonHides --
 * see `CommonCommands.java:54-58`) — so title/chrome commands are ALWAYS
 * tried before sprite commands, at the same relative fallback position.
 * Every parser wiring site in this port therefore calls
 * `matchAnnotationCommand` FIRST, then `matchSpriteCommand` SECOND, at the
 * position the annotation matcher already established.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/command/CommandFactorySprite.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/sprite/SpriteGrayLevel.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/WithSprite.java (registry contract)
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/skin/SkinParam.java:784-797 (registry impl)
 */

import { SpriteGrayLevel } from './klimt/sprite/SpriteGrayLevel.js';
import type { Sprite } from './klimt/sprite/Sprite.js';
import type { SpriteMonochrome } from './klimt/sprite/SpriteMonochrome.js';
import type { SpriteDimsLookup } from './creole-atoms.js';

// ---------------------------------------------------------------------------
// SpriteRegistry — per-diagram, mirroring `SkinParam.sprites`
// (java :784-797: `Map<String, Sprite>` + `addSprite`/`getSprite`).
// ---------------------------------------------------------------------------

export interface SpriteRegistry {
  readonly byName: Map<string, Sprite>;
  /**
   * Names of `sprite $name [WxH/color] { ... }` blocks encountered but NOT
   * registered — the `/color` (4096-color, `SpriteColorBuilder4096`)
   * encoding is out of THIS mission's fixture scope (D6/overview.md's
   * decode-only scope; no stdlib bundle vendored so far uses it). The
   * block is still fully consumed (never leaks into diagram content) —
   * only sprite registration is skipped. TODO(SpriteColorBuilder4096):
   * port the 4096-color decoder if a future stdlib bundle needs it.
   * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/sprite/SpriteColorBuilder4096.java
   */
  readonly skippedColorSprites: string[];
}

export function createSpriteRegistry(): SpriteRegistry {
  return { byName: new Map(), skippedColorSprites: [] };
}

/** @see WithSprite.java#addSprite / SkinParam.java:791-793 */
export function addSprite(registry: SpriteRegistry, name: string, sprite: Sprite): void {
  registry.byName.set(name, sprite);
}

/** @see SkinParam.java:795-800 (internal-sprite fallback NOT ported --
 *  `SpriteImage.fromInternal` serves PlantUML's own bundled icon set,
 *  out of this mission's scope; `undefined` where upstream falls back). */
export function getSprite(registry: SpriteRegistry, name: string): Sprite | undefined {
  return registry.byName.get(name);
}

// ---------------------------------------------------------------------------
// T7 seam (b) reconciliation (SI5b+E2r batch-2 decision-journal row):
// bridges this registry's `getSprite(name)` to T6's `SpriteDimsLookup.get`
// (creole-atoms.ts) for measurement, and exposes the concrete
// `SpriteMonochrome` (not just the narrow `Sprite` {width,height} surface)
// for T7's render-time tint/PNG pipeline (render-atoms.ts).
// ---------------------------------------------------------------------------

/** Bridges `getSprite` to T6's `SpriteDimsLookup` interface (D9 measurement
 *  seam, `creole-atoms.ts#measureLineWithAtoms`/`measureInlineAtom`) -- the
 *  `SpriteDimsLookup.get(name)` -> `SpriteRegistry.getSprite(name)` name-
 *  bridge the batch-2 journal flagged for this task. */
export function spriteDimsLookupFor(registry: SpriteRegistry): SpriteDimsLookup {
  return {
    get(name: string): { width: number; height: number } | undefined {
      const sprite = getSprite(registry, name);
      return sprite === undefined ? undefined : { width: sprite.width, height: sprite.height };
    },
  };
}

/** Render-time seam (T7): resolves a sprite by name as the concrete
 *  `SpriteMonochrome` every `sprite ... { }`/`sprite ... DATA` definition
 *  this registry stores actually is (`buildAndRegister`, above, only ever
 *  constructs one via `SpriteGrayLevel#buildSprite`/`buildSpriteZ`) -- the
 *  plain `Sprite` interface (`{width,height}`) is too narrow for T7's
 *  tint/PNG pipeline (`sprite-raster.ts#spriteToPngDataUri`), which needs
 *  `grayLevel`/`getGray` too (seam (a), that file's `spriteMonochromeAsLike`
 *  adapter). */
export function getSpriteMonochrome(registry: SpriteRegistry, name: string): SpriteMonochrome | undefined {
  return getSprite(registry, name) as SpriteMonochrome | undefined;
}

// ---------------------------------------------------------------------------
// Regex fragments (string-built -- see file doc: no `{`/`[`/`]` in regex
// literals per the project's complexity-hook workaround).
// ---------------------------------------------------------------------------

/** `\$?([-.%pLN_]+)` -- optional leading `$`, NAME captured without it. */
const NAME = '\\$?([-.\\w]+)';

/** `\[(\d+)x(\d+)/(?:(\d+)(z)?|(color))\]`, wrapped optional -- multiline
 *  form: `z` is itself optional (plain hex/6bit rows OR z-compressed). */
const DIM_MULTILINE = '(?:\\[(\\d+)x(\\d+)/(?:(\\d+)(z)?|(color))\\])?';

/** Single-line form: `z` is MANDATORY when DIM is present (there is no
 *  single-line plain-hex/6bit form -- only a compressed blob or a 4096
 *  color blob fits on one `DATA` token). */
const DIM_SINGLE_LINE = '(?:\\[(\\d+)x(\\d+)/(?:(\\d+)(z)|(color))\\])?';

const MULTILINE_START_RE = new RegExp('^sprite\\s+' + NAME + '\\s*' + DIM_MULTILINE + '\\s*\\{$', 'i');

/** `^end[%s]?sprite|\}$` -- two independent alternatives (NOT one anchored
 *  pattern): 'starts with end(sp)?sprite' OR 'ends with a closing brace
 *  anywhere on the line'. @see CommandFactorySprite.java:61 */
const END_RE = new RegExp('^end\\s?sprite|\\}$', 'i');

/** True when `trimmed` opens a `sprite $name [WxH/N] {` multiline block --
 *  the region-stripping counterpart to `descriptive-keywords.ts`'s
 *  `isLegendOpenLine`, so a large inlined sprite body (now that stdlib
 *  `!include`s actually resolve, plans/si5b-stdlib/batch-4/overview.md T9)
 *  never pushes the real diagram content past a keyword scan window. */
export function isSpriteMultilineOpenLine(trimmed: string): boolean {
  return MULTILINE_START_RE.test(trimmed);
}

/** True when `trimmed` closes a `sprite { ... }` multiline block. */
export function isSpriteMultilineCloseLine(trimmed: string): boolean {
  return END_RE.test(trimmed);
}

const SINGLE_LINE_RE = new RegExp(
  '^sprite\\s+' + NAME + '\\s*' + DIM_SINGLE_LINE + '\\s+([-_A-Za-z0-9]+)$',
  'i',
);

// ---------------------------------------------------------------------------
// Body post-processing -- BlocLines.removeEmptyColumns (java
// utils/BlocLines.java:234-263), same algorithm already ported once at
// core/annotations/commands.ts (duplicated here rather than imported: that
// module doesn't export it, and the two call sites are in different write-
// set boundaries for this mission's parallel batch).
// ---------------------------------------------------------------------------

function isFirstColumnRemovable(lines: readonly string[]): boolean {
  let allEmpty = true;
  for (const l of lines) {
    if (l.length === 0) continue;
    allEmpty = false;
    const c = l[0];
    if (c !== ' ' && c !== '\t') return false;
  }
  return !allEmpty;
}

function removeEmptyColumns(bodyLines: readonly string[]): string[] {
  let lines: string[] = [...bodyLines];
  while (isFirstColumnRemovable(lines)) {
    lines = lines.map((l) => (l.length > 0 ? l.slice(1) : l));
  }
  return lines;
}

/** `CommandFactorySprite#concat`: trim each line, join with no separator
 *  -- the z-compressed body is one long token split across source lines
 *  purely for readability. */
function concatSpriteBody(lines: readonly string[]): string {
  return lines.map((l) => l.trim()).join('');
}

// ---------------------------------------------------------------------------
// Sprite construction from a matched DIM group set
// ---------------------------------------------------------------------------

interface DimMatch {
  readonly width: string | undefined;
  readonly height: string | undefined;
  readonly nbLevel: string | undefined;
  readonly z: string | undefined;
  readonly color: string | undefined;
}

/** Builds and registers the sprite named by `name` from `bodyLines`
 *  (already column-stripped for the multiline forms; a single 1-element
 *  array carrying `DATA` for the single-line form), per
 *  `CommandFactorySprite#executeInternal` java :186-206. No-ops (registers
 *  nothing) for the `/color` form (journaled to `skippedColorSprites`), an
 *  invalid gray-level count, a failed z-decode, or an empty body -- all
 *  four mirror upstream's `CommandExecutionResult.error(...)` paths, which
 *  likewise never call `system.addSprite`. */
function buildAndRegister(
  registry: SpriteRegistry,
  name: string,
  dim: DimMatch,
  bodyLines: readonly string[],
): void {
  if (dim.color !== undefined) {
    registry.skippedColorSprites.push(name);
    return;
  }
  if (bodyLines.length === 0) return;

  if (dim.width === undefined) {
    // No `[WxH/...]` at all: 16 gray levels, dimensions deduced from the
    // data (java: `SpriteGrayLevel.GRAY_16.buildSprite(-1, -1, strings)`).
    addSprite(registry, name, SpriteGrayLevel.GRAY_16.buildSprite(-1, -1, bodyLines));
    return;
  }

  const width = parseInt(dim.width, 10);
  const height = parseInt(dim.height!, 10);
  const nbLevel = parseInt(dim.nbLevel!, 10);
  if (nbLevel !== 4 && nbLevel !== 8 && nbLevel !== 16) return;

  const level = SpriteGrayLevel.get(nbLevel);
  if (dim.z !== undefined) {
    const sprite = level.buildSpriteZ(width, height, concatSpriteBody(bodyLines));
    if (sprite !== null) addSprite(registry, name, sprite);
    return;
  }
  addSprite(registry, name, level.buildSprite(width, height, bodyLines));
}

function dimFromMatch(m: RegExpMatchArray, base: number): DimMatch {
  return {
    width: m[base],
    height: m[base + 1],
    nbLevel: m[base + 2],
    z: m[base + 3],
    color: m[base + 4],
  };
}

// ---------------------------------------------------------------------------
// Multiline block scanning
// ---------------------------------------------------------------------------

interface SpriteBlock {
  readonly bodyLines: readonly string[];
  readonly consumed: number;
}

/** Scans forward from `i + 1` for the first (trimmed) line matching
 *  `END_RE`, mirroring `core/annotations/commands.ts`'s
 *  `scanMultilineBlock`: no partial-match accumulation state machine, so
 *  an unterminated block returns `null` (falls through to being tried as
 *  something else, never silently swallowing the rest of the file). Body
 *  lines are blank-filtered first (`BlocLines#removeEmptyLines`, java
 *  :216-223) THEN column-stripped -- a blank line inside a sprite body is
 *  deleted outright, not preserved as an empty row. */
function scanSpriteBlock(lines: readonly string[], i: number): SpriteBlock | null {
  for (let j = i + 1; j < lines.length; j++) {
    if (END_RE.test((lines[j] ?? '').trim())) {
      const raw = lines.slice(i + 1, j).filter((l) => l.trim() !== '');
      return { bodyLines: removeEmptyColumns(raw), consumed: j - i + 1 };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Tries the sprite-definition grammar (multiline block, then single-line
 * inline-data form) at line `i`, mutating `registry` in place on a match.
 * Returns `null` (no mutation) if line `i` matches neither shape. Signature
 * mirrors `matchAnnotationCommand` exactly: `(lines, i, target) => {
 * consumed } | null`.
 */
export function matchSpriteCommand(
  lines: readonly string[],
  i: number,
  registry: SpriteRegistry,
): { consumed: number } | null {
  const trimmed = (lines[i] ?? '').trim();

  const multi = MULTILINE_START_RE.exec(trimmed);
  if (multi !== null) {
    const block = scanSpriteBlock(lines, i);
    if (block === null) return null;
    buildAndRegister(registry, multi[1]!, dimFromMatch(multi, 2), block.bodyLines);
    return { consumed: block.consumed };
  }

  const single = SINGLE_LINE_RE.exec(trimmed);
  if (single !== null) {
    const data = single[7]!;
    buildAndRegister(registry, single[1]!, dimFromMatch(single, 2), [data]);
    return { consumed: 1 };
  }

  return null;
}
