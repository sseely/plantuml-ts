/**
 * UGroupType — the SVG `<g>`/element attribute keys `UGroup` can carry
 * (id, class, title, and various `data-*` bookkeeping keys svek/layout
 * attach for traceability back to source).
 *
 * Upstream: klimt/UGroupType.java (a Java `enum`). Ported as an
 * as-const string-union object per project convention (no `const
 * enum`). `getSvgKeyAttributeName()` is ported below as a plain
 * function rather than an instance method, since the as-const object
 * carries no methods.
 */
export const UGroupType = {
  ID: 'ID',
  CLASS: 'CLASS',
  TITLE: 'TITLE',
  DATA_ENTITY: 'DATA_ENTITY',
  DATA_QUALIFIED_NAME: 'DATA_QUALIFIED_NAME',
  DATA_ENTITY_1: 'DATA_ENTITY_1',
  DATA_ENTITY_2: 'DATA_ENTITY_2',
  DATA_ENTITY_UID: 'DATA_ENTITY_UID',
  DATA_ENTITY_1_UID: 'DATA_ENTITY_1_UID',
  DATA_ENTITY_2_UID: 'DATA_ENTITY_2_UID',
  DATA_PARTICIPANT: 'DATA_PARTICIPANT',
  DATA_PARTICIPANT_1: 'DATA_PARTICIPANT_1',
  DATA_PARTICIPANT_2: 'DATA_PARTICIPANT_2',
  DATA_UID: 'DATA_UID',
  DATA_SOURCE_LINE: 'DATA_SOURCE_LINE',
  DATA_VISIBILITY_MODIFIER: 'DATA_VISIBILITY_MODIFIER',
  DATA_LINK_TYPE: 'DATA_LINK_TYPE',
} as const;
export type UGroupType = (typeof UGroupType)[keyof typeof UGroupType];

/**
 * getSvgKeyAttributeName — `UGroupType#getSvgKeyAttributeName()`
 * ported as a free function: lowercases the key and replaces `_` with
 * `-` (e.g. `DATA_SOURCE_LINE` -> `data-source-line`).
 */
export function getSvgKeyAttributeName(type: UGroupType): string {
  return type.toLowerCase().replace(/_/g, '-');
}

const NON_WORD = /[^-\w ]/g;

function fix(value: string): string {
  return value.replace(NON_WORD, '.');
}

/**
 * UGroup — a small `UGroupType -> string` attribute map, the shape
 * that becomes an SVG `<g id="..." class="..." data-...="...">`
 * element when rendered.
 *
 * Upstream: klimt/UGroup.java. Ported: `put`, `singletonMap`, `asMap`,
 * and the `fix` sanitizer (non-word/non-space/non-hyphen characters
 * become `.`).
 *
 * Adaptation: upstream's `UGroup(LineLocation location)` constructor
 * reduces `location` to the single field it actually reads
 * (`location.getPosition()`) as `{ position: number }`, the same
 * geometry-type-adaptation pattern this task applies to AWT-style
 * types — `LineLocation` itself (source-position tracking across the
 * parser) is out of scope for a shape. Callers that have a full
 * `LineLocation` equivalent can pass `{ position }` directly, or set
 * `DATA_SOURCE_LINE` via `put` themselves.
 */
export class UGroup {
  private readonly map = new Map<UGroupType, string>();

  constructor(location?: { readonly position: number } | null) {
    if (location != null) this.map.set(UGroupType.DATA_SOURCE_LINE, String(location.position));
  }

  put(key: UGroupType, value: string): void {
    this.map.set(key, fix(value));
  }

  static singletonMap(key: UGroupType, value: string): UGroup {
    const result = new UGroup();
    result.put(key, value);
    return result;
  }

  asMap(): ReadonlyMap<UGroupType, string> {
    return this.map;
  }
}
