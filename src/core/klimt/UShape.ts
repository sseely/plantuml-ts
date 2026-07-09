/**
 * UShape — marker interface for every drawable primitive in the klimt
 * rendering model (rectangles, lines, text, paths, ...). `UGraphic#draw`
 * dispatches on a shape's runtime constructor to find its registered
 * driver, mirroring upstream's `Class`-keyed driver map.
 *
 * Upstream: klimt/UShape.java — an empty marker interface (`public
 * interface UShape {}`). TS has no `instanceof`-free empty-interface
 * ban exemption, so this is ported with an explicit lint suppression
 * rather than inventing members upstream does not have.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- faithful port of upstream's empty marker interface (klimt/UShape.java); no members exist upstream.
export interface UShape {}
