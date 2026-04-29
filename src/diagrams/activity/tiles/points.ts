export interface GPoint { x: number; y: number; }

export const NORTH_HOOK   = 'NORTH_HOOK'  as const;
export const SOUTH_HOOK   = 'SOUTH_HOOK'  as const;
export const EAST_HOOK    = 'EAST_HOOK'   as const;
export const WEST_HOOK    = 'WEST_HOOK'   as const;
export const NORTH_BORDER = 'NORTH_BORDER' as const;
export const SOUTH_BORDER = 'SOUTH_BORDER' as const;

export type HookName =
  | typeof NORTH_HOOK | typeof SOUTH_HOOK
  | typeof EAST_HOOK  | typeof WEST_HOOK
  | typeof NORTH_BORDER | typeof SOUTH_BORDER;

export function gpoint(x: number, y: number): GPoint { return { x, y }; }
