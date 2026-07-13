/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TVariableScope.java
 */

export enum TVariableScope {
  LOCAL = 'LOCAL',
  GLOBAL = 'GLOBAL',
}

/**
 * TS enums cannot carry static methods; this free function is the
 * translation of `TVariableScope#lazzyParse` (upstream's own spelling,
 * preserved verbatim). Java `null` (unrecognized value) -> `undefined`.
 * @see ~/git/plantuml/.../tim/TVariableScope.java#lazzyParse
 */
export function lazzyParse(value: string): TVariableScope | undefined {
  if (value.toLowerCase() === 'local') return TVariableScope.LOCAL;
  if (value.toLowerCase() === 'global') return TVariableScope.GLOBAL;
  return undefined;
}
