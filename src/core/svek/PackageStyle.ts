/**
 * PackageStyle — the container "shape family" a group falls back to when
 * it has no explicit `USymbol` (e.g. a plain `package Foo { }` with no
 * stereotype driving a concrete symbol).
 *
 * Upstream: svek/PackageStyle.java (326 ln) — a Java `enum` with 12
 * members, `fromString(String)`, `toUSymbol()`, and a full `drawU`/
 * `drawXxx` family of private shape-drawing methods.
 *
 * Scope reduction (T12 — Cluster.java's drawing half only): grep of
 * `Cluster.java` confirms its only `PackageStyle` call is
 * `ClusterDecoration#guess`'s `style.toUSymbol()` — no caller anywhere
 * in `Cluster.java`/`ClusterDecoration.java` reaches `PackageStyle
 * #drawU()` or any private `drawXxx` method. That shape-drawing family
 * is a separate, older non-`USymbol` drawing path Cluster never
 * exercises: every shape it could draw is already covered by the
 * `USymbolFolder`/`USymbolRectangle`/`USymbolNode`/`USymbolFrame`/
 * `USymbolCloud`/`USymbolDatabase`/`USymbolCard` family (ported earlier
 * in this project). Only the 12-member union and `toUSymbol()`'s exact
 * mapping are ported here. `fromString` (skinparam-string parsing of a
 * `packageStyle` value) is a separate preprocessing concern with no
 * caller in this task's write-set — deferred to whichever task wires
 * skinparam parsing into a `Cluster` construction site.
 */
import type { USymbol } from '../decoration/symbol/USymbol.js';
import { USymbolFolder } from '../decoration/symbol/USymbolFolder.js';
import { USymbolRectangle } from '../decoration/symbol/USymbolRectangle.js';
import { USymbolNode } from '../decoration/symbol/USymbolNode.js';
import { USymbolFrame } from '../decoration/symbol/USymbolFrame.js';
import { USymbolCloud } from '../decoration/symbol/USymbolCloud.js';
import { USymbolDatabase } from '../decoration/symbol/USymbolDatabase.js';
import { USymbolCard } from '../decoration/symbol/USymbolCard.js';

/**
 * As-const object, not a TS `enum` (project convention — see
 * code-principles: no `const enum`). Upstream: `PackageStyle`'s 12
 * members, verbatim.
 */
export const PackageStyle = {
  FOLDER: 'FOLDER',
  RECTANGLE: 'RECTANGLE',
  NODE: 'NODE',
  FRAME: 'FRAME',
  CLOUD: 'CLOUD',
  DATABASE: 'DATABASE',
  AGENT: 'AGENT',
  STORAGE: 'STORAGE',
  COMPONENT1: 'COMPONENT1',
  COMPONENT2: 'COMPONENT2',
  ARTIFACT: 'ARTIFACT',
  CARD: 'CARD',
} as const;

export type PackageStyleName = (typeof PackageStyle)[keyof typeof PackageStyle];

/**
 * Upstream: `PackageStyle#toUSymbol()`. Returns `null` for AGENT/
 * STORAGE/COMPONENT1/COMPONENT2/ARTIFACT — matching upstream's own
 * fall-through-to-`null` exactly (those styles are never used as a bare
 * `ClusterDecoration` fallback in practice: components/artifacts/etc.
 * always carry their own explicit `USymbol`, so `ClusterDecoration
 * #guess` never actually needs a mapping for them).
 *
 * Direct `new USymbolXxx()` construction (rather than routing through
 * upstream's `USymbols` registry singleton, decoration/symbol/
 * USymbols.java) is a deliberate adaptation: that registry file is a
 * different task's write-set in this mission batch. Upstream's own
 * `USymbols.NODE`/`CARD`/etc. constants are themselves nothing more than
 * `new USymbolXxx(...)` singletons (see USymbols.java), so direct
 * construction here is behaviorally identical and avoids a cross-task
 * file dependency.
 */
export function packageStyleToUSymbol(style: PackageStyleName): USymbol | null {
  switch (style) {
    case PackageStyle.NODE:
      return new USymbolNode();
    case PackageStyle.CARD:
      return new USymbolCard();
    case PackageStyle.DATABASE:
      return new USymbolDatabase();
    case PackageStyle.CLOUD:
      return new USymbolCloud();
    case PackageStyle.FRAME:
      return new USymbolFrame('frame');
    case PackageStyle.RECTANGLE:
      return new USymbolRectangle('rectangle');
    case PackageStyle.FOLDER:
      return new USymbolFolder('package', true);
    default:
      return null;
  }
}
