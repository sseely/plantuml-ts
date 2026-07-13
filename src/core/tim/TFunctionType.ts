/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TFunctionType.java
 */

export enum TFunctionType {
  PROCEDURE = 'PROCEDURE',
  RETURN_FUNCTION = 'RETURN_FUNCTION',
  LEGACY_DEFINE = 'LEGACY_DEFINE',
  LEGACY_DEFINELONG = 'LEGACY_DEFINELONG',
}

/**
 * TS enums cannot carry instance methods; this free function is the
 * translation of `TFunctionType#isLegacy`.
 * @see ~/git/plantuml/.../tim/TFunctionType.java#isLegacy
 */
export function isLegacyTFunctionType(type: TFunctionType): boolean {
  return type === TFunctionType.LEGACY_DEFINE || type === TFunctionType.LEGACY_DEFINELONG;
}
