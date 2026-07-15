/**
 * scale-command.ts — shared `scale ...` directive parsing + factor
 * resolution (mission G1 I-scale).
 *
 * Upstream: 6 `SingleLineCommand2` subclasses register the diagram-wide
 * `scale` directive (`command/CommonCommands.java#addCommonScaleCommands`,
 * called from `CommonCommands#addCommonCommands1` — every `TitledDiagram`
 * factory examined, including `DescriptionDiagramFactory.java:90`, wires
 * it in via that one shared entry point):
 *
 *   CommandScale                  `scale N` / `scale N/M`       -> ScaleSimple
 *   CommandScaleWidthAndHeight     `scale WxH` / `scale W*H`     -> ScaleWidthAndHeight
 *   CommandScaleWidthOrHeight      `scale N width` / `scale N height` -> ScaleWidth/ScaleHeight
 *   CommandScaleMaxWidth           `scale max N width`           -> ScaleMaxWidth
 *   CommandScaleMaxHeight          `scale max N height`          -> ScaleMaxHeight
 *   CommandScaleMaxWidthAndHeight  `scale max WxH`                -> ScaleMaxWidthAndHeight
 *
 * Each command's `executeArg` builds a `Scale` strategy object
 * (`Scale.java`: `double getScale(double width, double height)`) that
 * resolves a scalar FACTOR from the diagram's own UNSCALED (pre-scale)
 * document dimension — `TextBlockExporter#computeScaleFactor`
 * (`core/TextBlockExporter.java:205-209`): `scale.getScale(dim.width,
 * dim.height) * dpi/96.0` (dpi is always 96 in this port — no `skinparam
 * dpi` wiring exists anywhere, confirmed by grep, so the `*dpi/96` term is
 * always exactly 1 and is not reproduced here). Every `Scale`
 * implementation (`ScaleSimple`/`ScaleWidth`/`ScaleHeight`/
 * `ScaleWidthAndHeight`/`ScaleMaxWidth`/`ScaleMaxHeight`/
 * `ScaleMaxWidthAndHeight`, all `net/sourceforge/plantuml/Scale*.java`) is
 * `final class X extends ScaleProtected` — `ScaleProtected#getScale`
 * (`ScaleProtected.java:42-51`) clamps the raw computed factor uniformly:
 * `<= 0 -> 1`, `> 4 -> 4`, otherwise unchanged. That shared clamp is the
 * ONLY reason `component/berome-43-xini276` (`scale 10`) renders at an
 * effective x4, not x10 — jar-verified
 * (`test-results/dot-cache/component/berome-43-xini276/in.svg`:
 * `text/@font-size="56"` = the un-stereotyped title's base 14 * 4).
 *
 * The resolved factor is applied ONLY at SVG-emission time: every numeric
 * coordinate/font-size/stroke-width/textLength the description engine
 * draws is multiplied at `format()` time by `SvgOption.scale`
 * (`svg-graphics-core.ts`'s `SvgGraphicsCore#format`/
 * `#finalizeRootAttributes` — an ALREADY-FAITHFUL, pre-existing port of
 * `SvgGraphics.java#format:881-884` and `#finalizeRootAttributes:750-773`;
 * jar-verified against `component/saveje-35-vumu271/in.svg`, `scale 2`:
 * EVERY primitive — `rect/@x`, `text/@font-size`, `path` `style="...
 * stroke-width:2"`, `ellipse/@rx` — is exactly 2x its unscaled value, and
 * the root `viewBox`/`width`/`height` are likewise the scaled document
 * extent, `Math.trunc`'d). This module supplies the ONE missing piece:
 * something to SET `SvgOption.scale` to besides its hardcoded default of
 * `1.0` — `svg-graphics-core.ts` itself is untouched by this mission.
 *
 * Layout itself (the DOT graph, node/edge positions) reads NONE of this —
 * upstream accumulates `maxX`/`maxY` in the UNSCALED coordinate space via
 * `ensureVisible` (called with raw, pre-scale coordinates from every draw
 * call) and only multiplies by scale in `finalizeRootAttributes`, well
 * after DOT/svek layout has already run; this port's `format`/
 * `finalizeRootAttributes` mirror that split exactly (`this.maxX`/
 * `this.maxY` accumulate unscaled in `ensureVisible`, `this.option.scale`
 * is read only inside `format`/`finalizeRootAttributes` themselves).
 *
 * `CommandScale`'s registration is shared across every `TitledDiagram`
 * subtype (component/usecase, class, state, sequence, …) — this module is
 * deliberately diagram-type-agnostic (pure parsing + pure factor
 * resolution, no AST/geometry types imported) so a future class/state/etc.
 * iteration can wire it in without re-deriving the mechanism; only the
 * description engine's parser/layout/renderer
 * (`description/command-table.ts`, `ast.ts`, `layout.ts`, `renderer.ts`)
 * are wired to it this iteration (G1 I-scale's own write-set boundary).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/command/CommandScale.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/command/CommandScaleWidthAndHeight.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/command/CommandScaleWidthOrHeight.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/command/CommandScaleMaxWidth.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/command/CommandScaleMaxHeight.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/command/CommandScaleMaxWidthAndHeight.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/Scale.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/ScaleProtected.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/ScaleSimple.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/ScaleWidth.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/ScaleHeight.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/ScaleWidthAndHeight.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/ScaleMaxWidth.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/ScaleMaxHeight.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/ScaleMaxWidthAndHeight.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/TextBlockExporter.java
 * @see plans/g1-description-svg/decision-journal.md (I-scale)
 */

export type ScaleSpec =
  | { readonly kind: 'simple'; readonly factor: number }
  | { readonly kind: 'width'; readonly target: number }
  | { readonly kind: 'height'; readonly target: number }
  | { readonly kind: 'widthAndHeight'; readonly width: number; readonly height: number }
  | { readonly kind: 'maxWidth'; readonly target: number }
  | { readonly kind: 'maxHeight'; readonly target: number }
  | { readonly kind: 'maxWidthAndHeight'; readonly width: number; readonly height: number };

const RE_SCALE_SIMPLE = /^scale\s+([0-9.]+)\s*(?:\/\s*([0-9.]+)\s*)?$/i;
const RE_SCALE_WIDTH_AND_HEIGHT = /^scale\s+([0-9.]+)\s*[*x]\s*([0-9.]+)\s*$/i;
const RE_SCALE_WIDTH_OR_HEIGHT = /^scale\s+([0-9.]+)\s+(width|height)\s*$/i;
const RE_SCALE_MAX_WIDTH = /^scale\s+max\s+([0-9.]+)\s+width\s*$/i;
const RE_SCALE_MAX_HEIGHT = /^scale\s+max\s+([0-9.]+)\s+height\s*$/i;
const RE_SCALE_MAX_WIDTH_AND_HEIGHT = /^scale\s+max\s+([0-9.]+)\s*[*x]\s*([0-9.]+)\s*$/i;

/** `CommandScale.executeArg:93-101` errors on a zero numerator or
 *  denominator; this port has no diagram-level error-recovery seam for a
 *  single bad directive to surface through, so a zero-scale line is left
 *  unmatched — the same disposition every other unimplemented/rejected
 *  directive in this parser already gets (see `command-table.ts`'s
 *  `remove`/`restore` handling for the established precedent). */
function buildSimple(m: RegExpExecArray): ScaleSpec | undefined {
  const numerator = Number(m[1]);
  const denominator = m[2] === undefined ? 1 : Number(m[2]);
  if (numerator === 0 || denominator === 0) return undefined;
  return { kind: 'simple', factor: numerator / denominator };
}

function buildWidthOrHeight(m: RegExpExecArray): ScaleSpec {
  const target = Number(m[1]);
  return m[2]!.toLowerCase() === 'width' ? { kind: 'width', target } : { kind: 'height', target };
}

// Registration order mirrors `CommonCommands#addCommonScaleCommands`
// exactly (CommandScale, CommandScaleWidthAndHeight,
// CommandScaleWidthOrHeight, CommandScaleMaxWidth, CommandScaleMaxHeight,
// CommandScaleMaxWidthAndHeight). Every upstream pattern is fully anchored
// (`RegexLeaf.start()`/`.end()`), so match order cannot actually change
// which one wins for any real input — a table (tried top-to-bottom, first
// match wins), not a chain of `if`s, keeps `matchScaleCommand` itself flat
// (one loop, one branch) regardless of how many scale forms exist.
const SCALE_MATCHERS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly build: (m: RegExpExecArray) => ScaleSpec | undefined;
}> = [
  { pattern: RE_SCALE_SIMPLE, build: buildSimple },
  {
    pattern: RE_SCALE_WIDTH_AND_HEIGHT,
    build: (m) => ({ kind: 'widthAndHeight', width: Number(m[1]), height: Number(m[2]) }),
  },
  { pattern: RE_SCALE_WIDTH_OR_HEIGHT, build: buildWidthOrHeight },
  { pattern: RE_SCALE_MAX_WIDTH, build: (m) => ({ kind: 'maxWidth', target: Number(m[1]) }) },
  { pattern: RE_SCALE_MAX_HEIGHT, build: (m) => ({ kind: 'maxHeight', target: Number(m[1]) }) },
  {
    pattern: RE_SCALE_MAX_WIDTH_AND_HEIGHT,
    build: (m) => ({ kind: 'maxWidthAndHeight', width: Number(m[1]), height: Number(m[2]) }),
  },
];

/**
 * Parses one `scale ...` directive line into a `ScaleSpec`, or `undefined`
 * when `line` is not a recognized scale form (see `buildSimple`'s doc
 * comment for the `scale 0`/`scale N/0` rejection case).
 */
export function matchScaleCommand(line: string): ScaleSpec | undefined {
  for (const { pattern, build } of SCALE_MATCHERS) {
    const match = pattern.exec(line);
    if (match !== null) return build(match);
  }
  return undefined;
}

/** `ScaleProtected#getScale` (`ScaleProtected.java:42-51`) — every `Scale`
 *  implementation's shared clamp, applied uniformly AFTER the
 *  strategy-specific raw factor below is computed. */
function clampScale(raw: number): number {
  if (raw <= 0) return 1;
  if (raw > 4) return 4;
  return raw;
}

/**
 * Resolves a `ScaleSpec` into the final, clamped scale FACTOR to feed into
 * `SvgOption.scale` — one `Scale#getScale(width, height)` strategy per
 * `ScaleSpec.kind` (`ScaleSimple`/`ScaleWidth`/`ScaleHeight`/
 * `ScaleWidthAndHeight`/`ScaleMaxWidth`/`ScaleMaxHeight`/
 * `ScaleMaxWidthAndHeight`, all `net/sourceforge/plantuml/Scale*.java`),
 * clamped by `ScaleProtected`. `width`/`height` MUST be the diagram's own
 * UNSCALED document dimension (`TextBlockExporter
 * #calculateFinalDimension` — this port's `computeDocumentDims` result, or
 * `geo.totalWidth`/`totalHeight` for a degenerate single-leaf geometry,
 * BEFORE any scale is applied) — the exact same dimension DOT/layout
 * already computed and `SvgOption.minDim` is built from, never re-derived
 * from an already-scaled value.
 */
export function resolveScaleFactor(
  spec: ScaleSpec | undefined,
  width: number,
  height: number,
): number {
  if (spec === undefined) return 1;
  switch (spec.kind) {
    case 'simple':
      return clampScale(spec.factor);
    case 'width':
      return clampScale(spec.target / width);
    case 'height':
      return clampScale(spec.target / height);
    case 'widthAndHeight':
      return clampScale(Math.min(spec.width / width, spec.height / height));
    case 'maxWidth':
      return clampScale(Math.min(1, spec.target / width));
    case 'maxHeight':
      return clampScale(Math.min(1, spec.target / height));
    case 'maxWidthAndHeight':
      return clampScale(Math.min(1, Math.min(spec.width / width, spec.height / height)));
  }
}
