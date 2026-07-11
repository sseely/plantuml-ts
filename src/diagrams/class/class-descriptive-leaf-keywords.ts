/**
 * Class-engine descriptive-leaf keyword tables — upstream
 * `CommandCreateElementFull2`'s full leaf set (`(state|` + descdiagram's
 * shared `CommandCreateElementFull.ALL_TYPES` + `)`).
 *
 * Split out of class-declaration-parser.ts purely to keep that file under
 * the repo's 500-line-per-file cap (pure move, no behavior change) — mirrors
 * class-descriptive-leaf-command.ts's own "split out of a capped file"
 * precedent. Data-only (no logic, no imports), consumed by BOTH
 * class-declaration-parser.ts (DECL_KIND_RE + resolveDeclKind) and
 * class-descriptive-leaf-command.ts (its trigger pattern) — a shared leaf
 * avoids a circular import between those two files.
 *
 * @see ~/git/plantuml/.../descdiagram/command/CommandCreateElementFull.java:76
 * @see ~/git/plantuml/.../classdiagram/command/CommandCreateElementFull2.java:84
 */

/**
 * Full `CommandCreateElementFull2` leaf set. All render as a plain rect at
 * the DOT level — the USymbol icon is drawn INSIDE the svek rect, never
 * changing the graphviz `shape` (verified per-keyword against the oracle
 * svek DOT — oracle/goldens/object/gapisu-00-celo011). Excludes `entity`/
 * `interface`/`circle` (ALSO native class-declaration keywords — upstream
 * registers `CommandCreateClass`/`-EntityObjectMultilines` BEFORE this
 * command, so they keep their existing DECL_KIND_RE routing rather than
 * falling into the generic 'descriptive' bucket here); `usecase`/`usecase/`/
 * `state` are split below (non-rect / non-descriptive kinds).
 */
export const DESCRIPTIVE_LEAF_KEYWORDS =
  'person|artifact|actor/|actor|folder|card|file|package|rectangle|hexagon|' +
  'label|node|frame|cloud|action|process|database|queue|stack|storage|agent|' +
  'component|boundary|control|collections|port|portin|portout';
/** `usecase`/`usecase/` -> ellipse; the only non-rect ALL_TYPES leaves
 *  (longer token first, mirrors upstream's own ALL_TYPES literal order). */
export const USECASE_LEAF_KEYWORDS = 'usecase/|usecase';
/** `state` -> rounded rect (LeafType.STATE); a classdiagram-only ALL_TYPES
 *  addition, NOT in descdiagram's shared table (see ClassifierKind's doc). */
export const STATE_LEAF_KEYWORD = 'state';
/** All descriptive leaf keywords the class declaration parser accepts. */
export const ALL_DESCRIPTIVE_LEAF =
  `${DESCRIPTIVE_LEAF_KEYWORDS}|${USECASE_LEAF_KEYWORDS}|${STATE_LEAF_KEYWORD}`;
