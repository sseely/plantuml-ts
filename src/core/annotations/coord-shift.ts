/**
 * coord-shift.ts — mission G1d: the eager-arithmetic equivalent of
 * upstream's `UGraphic.apply(new UTranslate(dx, dy))` coordinate-context
 * threading (`klimt/UGraphic.java`/`UTranslate.java`, already ported at
 * `src/core/klimt/UTranslate.ts` and used pervasively inside the klimt
 * subsystem itself — see e.g. `TextBlockHorizontal.ts`,
 * `UHorizontalLine.ts`).
 *
 * `chrome.ts#decorateEntityImage` (`DecorateEntityImage#drawU`,
 * `svek/DecorateEntityImage.java:103-167`) draws its "original" (the
 * previously-composed block) and each text slot at an absolute offset
 * WITHIN the shared coordinate context upstream's `UGraphic` provides —
 * every `<text>`/`<rect>`/`<path>` upstream ultimately emits already
 * carries its FINAL absolute x/y, never a `<g transform>` wrapper (jar's
 * cached annotated SVGs, `test-results/dot-cache/**\/in.svg`, verified:
 * zero `transform=` occurrences across all 19 G1 I1 chrome fixtures).
 *
 * `RenderFragment.body` in this port is a flat, ALREADY-SERIALIZED string
 * (T3's decision) — chrome.ts has no coordinate-context object to thread
 * an offset through for a fragment built by another engine's renderer. So
 * this module is chrome.ts's own composition step doing what
 * `UGraphic.apply(UTranslate).draw(shape)` does lazily, but eagerly and
 * textually: shift every coordinate-bearing attribute a KNOWN, fully
 * project-controlled vocabulary of SVG-emitting code (`core/svg.ts`,
 * `core/klimt/drawing/svg/svg-graphics-elements.ts`, and the handful of
 * hand-built `d=`/`points=` producers grep-verified during G1d's design
 * phase — see the mission decision journal) is confirmed to emit, by the
 * shift amount — NOT a general SVG parser/transformer, exactly like this
 * module's siblings (`unwrapKlimtSvg`'s own doc comment) stay scoped to
 * their exact known producer shape rather than becoming one.
 *
 * Fast path: `dx === 0 && dy === 0` returns `body` unchanged (`===`-free
 * but textually byte-identical) — the common case for any annotation-only
 * fixture whose text slots are all BOTTOM-aligned and no narrower than the
 * body (`decorateEntityImage`'s `xImage`/`yImage` both resolve to 0), so
 * the vast majority of already-passing annotated fixtures see zero new
 * floating-point noise from this module.
 *
 * @see ~/git/plantuml/.../svek/DecorateEntityImage.java:103-167 (drawU)
 * @see ~/git/plantuml/.../klimt/UGraphic.java#apply
 */

/** Matches a JS-`Number`-parseable numeric token — integer, decimal, or
 *  exponential, optionally signed. Every numeric attribute value / path
 *  coordinate / points-list entry this codebase emits (`core/svg.ts`'s
 *  `attrs()` helper, klimt's `format()`) is exactly this shape. */
const NUMBER_RE = /-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g;

/** Attribute names whose value is a single X or Y position this codebase
 *  ever emits with a plain numeric value (grep-verified against
 *  `core/svg.ts` + `core/klimt/drawing/svg/svg-graphics-elements.ts` +
 *  every hand-built SVG string producer under `src/diagrams/`/`src/core/`
 *  — the mission decision journal records the full inventory). `width`/
 *  `height`/`rx`/`ry`/`r` are DIMENSIONS, not positions, and a pure
 *  translation never changes them — deliberately excluded. `dx`/`dy` are
 *  relative nudges (creole tspan kerning), not absolute positions —
 *  deliberately excluded. */
const X_ATTRS = new Set(['x', 'cx', 'x1', 'x2']);
const Y_ATTRS = new Set(['y', 'cy', 'y1', 'y2']);

/** Path-data command letters this codebase ever emits — always absolute
 *  (uppercase), never the lowercase relative spelling (grep-verified: the
 *  ONE path serializer, `svg-graphics-elements.ts#renderPathSegment`, and
 *  every hand-built `d=` string, e.g. `core/svg.ts`'s note-fold icon,
 *  `usymbol-shapes.ts`'s database cylinder, `sequence/renderer.ts`'s
 *  lifeline cap — all emit M/L/Q/C/A/Z uppercase only). */
const PATH_COMMAND_RE = /([MLCQAZ])([^MLCQAZ]*)/g;

function shiftNumberToken(raw: string, delta: number): string {
  return String(Number(raw) + delta);
}

/** `points="x,y x,y ..."` (`core/svg.ts#polygon`/`#diamond`, space between
 *  pairs) OR `points="x,y,x,y,..."` (klimt's own arrowhead polygons, ALL
 *  comma-separated, matching jar's own convention exactly) — separator
 *  characters are irrelevant here since every Nth numeric TOKEN (0-indexed)
 *  alternates X/Y regardless of what punctuation surrounds it. */
function shiftPoints(value: string, dx: number, dy: number): string {
  let index = 0;
  return value.replace(NUMBER_RE, (token) => {
    const delta = index % 2 === 0 ? dx : dy;
    index += 1;
    return shiftNumberToken(token, delta);
  });
}

/**
 * `d="M#,# C#,# #,# #,# ..."` etc — shifts one path-data command's numeric
 * argument list per its OWN coordinate shape
 * (`svg-graphics-elements.ts#renderPathSegment`'s exact per-command
 * argument layout):
 *  - M/L: one (x,y) pair.
 *  - Q: two (x,y) pairs (control point, endpoint).
 *  - C: three (x,y) pairs (two control points, endpoint) — every pair
 *    (including control points) shifts under a pure translation.
 *  - A: `rx,ry,x-axis-rotation,large-arc-flag,sweep-flag,x,y` — only the
 *    FINAL (x,y) endpoint pair (indices 5,6) is a position; the first five
 *    are radii/angle/flags, unaffected by translation.
 *  - Z: no arguments.
 */
function shiftPathD(value: string, dx: number, dy: number): string {
  return value.replace(PATH_COMMAND_RE, (segment, command: string, args: string) => {
    if (command === 'Z') return segment;
    let index = 0;
    const shiftedArgs = args.replace(NUMBER_RE, (token: string) => {
      const i = index;
      index += 1;
      if (command === 'A') {
        if (i === 5) return shiftNumberToken(token, dx);
        if (i === 6) return shiftNumberToken(token, dy);
        return token;
      }
      return shiftNumberToken(token, i % 2 === 0 ? dx : dy);
    });
    return command + shiftedArgs;
  });
}

/** `transform="translate(a,b)"` / `transform="rotate(deg,cx,cy)"` — the
 *  only two transform functions this codebase's non-chrome producers ever
 *  emit (`json/renderer.ts`'s tree nesting, `chart/renderer.ts`'s rotated
 *  axis titles; grep-verified during G1d's design phase). Composing a
 *  uniform translation (dx,dy) into either is exact: for `translate`,
 *  vector addition; for `rotate(deg,cx,cy)`, shifting the pivot by the SAME
 *  (dx,dy) the rotated content's own x/y also shifts by is algebraically
 *  equivalent to translating the whole already-rotated result by (dx,dy)
 *  (verified: `rotate(deg,cx+dx,cy+dy)` applied to a point P+dx,dy equals
 *  `translate(dx,dy)` applied to `rotate(deg,cx,cy)` applied to P, for any
 *  P — the mission decision journal records the algebraic proof). An
 *  unrecognized transform function is left untouched rather than silently
 *  mis-shifted — never produced by this codebase's own emitters.
 */
function shiftTransform(value: string, dx: number, dy: number): string {
  const translate = /^translate\(([^,]+),([^)]+)\)$/.exec(value.trim());
  if (translate !== null) {
    const a = Number(translate[1]);
    const b = Number(translate[2]);
    return `translate(${String(a + dx)},${String(b + dy)})`;
  }
  const rotate = /^rotate\(([^,]+),([^,]+),([^)]+)\)$/.exec(value.trim());
  if (rotate !== null) {
    const deg = rotate[1];
    const cx = Number(rotate[2]);
    const cy = Number(rotate[3]);
    return `rotate(${String(deg)},${String(cx + dx)},${String(cy + dy)})`;
  }
  return value;
}

const SHIFTABLE_ATTR_RE = /\b(x|y|cx|cy|x1|y1|x2|y2|points|d|transform)="([^"]*)"/g;

/**
 * Bakes a (dx,dy) translation into every coordinate-bearing attribute of an
 * already-serialized SVG fragment string — see this module's doc comment
 * for the full mechanism and scope. Pure function: no mutation, no DOM.
 */
export function shiftFragmentBody(body: string, dx: number, dy: number): string {
  if (dx === 0 && dy === 0) return body;
  return body.replace(SHIFTABLE_ATTR_RE, (match, name: string, value: string) => {
    if (X_ATTRS.has(name)) return `${name}="${shiftNumberToken(value, dx)}"`;
    if (Y_ATTRS.has(name)) return `${name}="${shiftNumberToken(value, dy)}"`;
    if (name === 'points') return `points="${shiftPoints(value, dx, dy)}"`;
    if (name === 'd') return `d="${shiftPathD(value, dx, dy)}"`;
    return `transform="${shiftTransform(value, dx, dy)}"`;
  });
}
