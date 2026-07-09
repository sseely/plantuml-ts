/**
 * UChange — marker interface for every state transition `UGraphic#apply`
 * accepts (translate, stroke, foreground/background color, ...).
 * `AbstractCommonUGraphic#apply` dispatches on a change's runtime type to
 * decide which piece of state to update on the copy it returns.
 *
 * Upstream: klimt/UChange.java — an empty marker interface (`public
 * interface UChange {}`).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- faithful port of upstream's empty marker interface (klimt/UChange.java); no members exist upstream.
export interface UChange {}
