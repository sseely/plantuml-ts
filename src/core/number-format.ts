/**
 * Java-compatible `%.4f` (HALF_UP) numeric formatting.
 *
 * Extracted from `core/klimt/drawing/svg/svg-graphics-core.ts`'s private
 * `javaFixed4`/`trimTrailingZeros` (G2 N4, pure move -- `svg-graphics-
 * core.ts`'s own `format()` now delegates here, zero behavior change,
 * verified by the description census staying byte-identical). A leaf
 * dependency (no imports) so non-klimt callers (`class/class-layout-
 * helpers.ts`'s `textLength` values) can reuse the SAME rounding without
 * pulling in the klimt drawing stack.
 *
 * @see ~/git/plantuml/.../klimt/drawing/svg/SvgGraphics.java (format)
 */

/**
 * Renders `%.4f` (Locale.US, HALF_UP) the way Java's `java.util.Formatter`
 * does it — HALF_UP rounding applied to the value's SHORTEST ROUND-TRIP
 * DECIMAL STRING, not to its exact IEEE754 binary value. Java's Formatter
 * builds its decimal digits via `FloatingDecimal`/`FormattedFloatingDecimal`
 * (the same "shortest string that reads back to this double" algorithm
 * `Double.toString` uses), then rounds THAT digit string HALF_UP. JS's
 * `Number.prototype.toFixed` instead rounds the double's true (long, often
 * non-terminating) binary expansion — for a value whose shortest decimal
 * sits exactly on a rounding boundary at the 4th place (e.g. 8.69375, whose
 * real double is 8.6937499999999996447...), `toFixed(4)` rounds DOWN
 * ("8.6937") while Java's `%.4f` rounds UP ("8.6938"): the last-decimal-
 * digit divergence jar-verified against `component/luniju-97-tuja870`'s
 * `text/@textLength` (mission G1/I4). `Number.prototype.toString()` already
 * implements the same "shortest round-trip decimal" class of algorithm
 * `Double.toString` does (both are correctly-rounded shortest-digit-string
 * conversions), so reusing it here — rather than re-deriving digits from
 * the binary mantissa — reproduces Java's rounding INPUT faithfully without
 * a second bespoke float-to-decimal implementation.
 */
export function javaFixed4(x: number): string {
  const neg = x < 0;
  const shortest = Math.abs(x).toString();
  // `toString()` only switches to exponential notation for |x| >= 1e21 or
  // 0 < |x| < 1e-6 -- SVG pixel geometry never reaches either extreme (nor
  // does the jar's own %.4f range), so a plain decimal-notation string is
  // assumed below.
  /* v8 ignore next 3 -- unreachable for SVG geometry, see comment above */
  if (shortest.includes('e')) {
    return Math.abs(x).toFixed(4);
  }
  const dot = shortest.indexOf('.');
  const intPart = dot < 0 ? shortest : shortest.slice(0, dot);
  const fracPart = dot < 0 ? '' : shortest.slice(dot + 1);
  // Pad to (at least) 5 fractional digits so there is always a digit to
  // make the HALF_UP round/no-round decision on.
  const padded = (fracPart + '00000').slice(0, Math.max(5, fracPart.length));
  const keep = padded.slice(0, 4);
  const roundUp = padded.charCodeAt(4) - 48 >= 5;
  let digits = intPart + keep; // decimal point implicitly 4 digits from the right
  if (roundUp) digits = (BigInt(digits) + 1n).toString();
  const fracOut = digits.slice(-4);
  const intOut = digits.length > 4 ? digits.slice(0, digits.length - 4) : '0';
  return (neg ? '-' : '') + intOut + '.' + fracOut;
}

/**
 * Trims the trailing zeros (and the decimal point itself, if nothing
 * follows it) off a `%.4f`-formatted numeric string.
 * Upstream: the shared tail of `SvgGraphics#format`'s body.
 */
export function trimTrailingZeros(s: string): string {
  const dot = s.indexOf('.');
  if (dot < 0) return s;
  let end = s.length - 1;
  while (end > dot && s[end] === '0') end--;
  if (end === dot) end--;
  return s.slice(0, end + 1);
}

/** `javaFixed4` + `trimTrailingZeros`, then parsed back to a `number` --
 *  the convenience form non-string-emission callers need (e.g. a
 *  `ClassifierGeo.rows[].width` value that must round-trip through JSON-
 *  shaped geometry before reaching `core/svg.ts#text()`'s own numeric
 *  attribute stringification). */
export function javaRound4(x: number): number {
  return Number(trimTrailingZeros(javaFixed4(x)));
}
