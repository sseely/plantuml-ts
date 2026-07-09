/**
 * Side — the four cardinal sides `ExtremityCrowfoot` clamps its
 * left/right wing endpoints against when the link approaches a node
 * from directly N/E/S/W (see `ExtremityCrowfoot.ts`).
 *
 * Upstream: klimt/geom/Side.java (a Java `enum`). Ported as an as-const
 * string-union object per project convention (no `const enum`).
 */
export const Side = {
  NORTH: 'NORTH',
  EAST: 'EAST',
  SOUTH: 'SOUTH',
  WEST: 'WEST',
} as const;
export type Side = (typeof Side)[keyof typeof Side];
