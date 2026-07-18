/**
 * class-assoc-subsume.ts — the "subsume an explicit A-B association into a
 * couple" mechanism (`Association#createNew`'s `existingLink`/`removeLink`
 * lookup), split out of `class-assoc-couple.ts` to keep that file under the
 * project's 500-line cap (G2 N20 -- pure move, no behavior change; every
 * symbol here was previously defined verbatim in that file).
 */
import type { ClassDiagramAST, Relationship, LinkDecor } from './ast.js';
import { EDGE_DECORATION_MAP } from './class-dot-graph.js';

export interface SubsumedLink {
  a: string | undefined;
  b: string | undefined;
  portA: string | undefined;
  portB: string | undefined;
  length: number | undefined;
  label: string | undefined;
  linkNote: string | undefined;
  /**
   * G2 N8: the subsumed edge's own per-end decor, resolved to its EFFECTIVE
   * value (`ex.sourceDecor`/`targetDecor`, falling back to
   * `EDGE_DECORATION_MAP[ex.type]` the same way `layout.ts#buildEdgeGeos`
   * does) — feeds `Association#createNew`'s `getPart1()`/`getPart2()` split
   * (decor1→the `a`-side edge's OWN end, NONE at the circle end; decor2→the
   * `b`-side edge's OWN end, NONE at the circle end). `aSideDecor`/
   * `bSideDecor` name the decor at THAT classifier's own end of the
   * ORIGINAL two-entity link, oriented so `makeCoupleCircle` never has to
   * re-derive `ex.from === aId` itself. NOT verified against a link.
   * isInverted()-normalized original entity (upstream's own bookkeeping for
   * a link parsed in reversed textual order) — every corpus fixture that
   * reaches this path subsumes a plain, undecorated `--`/`-` association
   * (jar-verified survey, G2 N8), so this simplification is unreached by
   * any known fixture; flagged, not fixed, for a decorated-subsumed-edge
   * case if one is ever found.
   */
  aSideDecor: LinkDecor | undefined;
  bSideDecor: LinkDecor | undefined;
  /** The subsumed edge's own body dash-style — carried to BOTH new entity
   *  edges unchanged (`LinkType`'s `linkStyle` is untouched by `getPart1()`/
   *  `getPart2()`, only `decor1`/`decor2` are split). */
  dashed: boolean | undefined;
  /**
   * G2 N19: the REMOVED explicit edge's own `Relationship.creationIndex`
   * (when it had one) — jar's raw shared counter ALREADY advanced past this
   * relationship's own real `Link()` construction, back when the plain
   * `A -- B` line was first parsed; `removeLink(existingLink)`
   * (`Association#createNew`, no NEW `Link()` call) does NOT un-burn that
   * slot. Dense re-numbering must NOT silently collapse this gap the way it
   * correctly collapses a phantom classifier stub that never became a real
   * jar `Entity` at all (`renderer-uid.ts`'s own module doc comment) — this
   * removed link WAS real. Fed into `Classifier.subsumedLinkCreationIndex`
   * (ast.ts) so `renderer-uid.ts` can inject the missing phantom rank.
   * Jar-verified: `jaloja-18-tisu915`'s `Enrollment` (auto-created by the
   * couple's own `ensure(c)` AFTER the subsumed `Student -- Course` line)
   * numbers ent0004, not the naively-dense ent0003.
   */
  creationIndex: number | undefined;
}

export const EMPTY_SUBSUMED: SubsumedLink = {
  a: undefined,
  b: undefined,
  portA: undefined,
  portB: undefined,
  length: undefined,
  label: undefined,
  linkNote: undefined,
  aSideDecor: undefined,
  bSideDecor: undefined,
  dashed: undefined,
  creationIndex: undefined,
};

/** Index of the LAST relationship directly between aId/bId (either direction),
 *  mirroring `AbstractClassOrObjectDiagram#foundLink`'s backward scan — when
 *  TWO relationships exist between the same pair (begico-70-guva302: a
 *  composition AND a later separate dotted association between
 *  `research`/`correlations`), the couple subsumes the MOST RECENTLY declared
 *  one, leaving earlier ones as their own separate edges. -1 when none. */
function findLastAssociationIndex(rels: readonly Relationship[], aId: string, bId: string): number {
  for (let i = rels.length - 1; i >= 0; i--) {
    const r = rels[i]!;
    if ((r.from === aId && r.to === bId) || (r.from === bId && r.to === aId)) return i;
  }
  return -1;
}

/**
 * Remove an explicit `A -- B` association (the couple subsumes it) and return
 * its multiplicities/ports/length/label/linkNote, oriented to the a/b sides
 * (a `Class::member` port on the subsumed edge still shields the classifier —
 * see `makeCoupleCircle`'s `portA`/`portB` comment). Returns all-`undefined`
 * when none existed.
 */
export function subsumeExplicitAssociation(ast: ClassDiagramAST, aId: string, bId: string): SubsumedLink {
  const idx = findLastAssociationIndex(ast.relationships, aId, bId);
  if (idx < 0) return EMPTY_SUBSUMED;
  const ex = ast.relationships[idx]!;
  ast.relationships.splice(idx, 1);
  // Effective per-end decor, resolved the same way `layout.ts#buildEdgeGeos`
  // resolves a relationship's own decor (explicit override, else the
  // type-derived default) — see `SubsumedLink.aSideDecor`'s doc comment.
  const decor = EDGE_DECORATION_MAP[ex.type];
  const exSourceDecor = ex.sourceDecor ?? decor.sourceDecor;
  const exTargetDecor = ex.targetDecor ?? decor.targetDecor;
  const exDashed = ex.dashed ?? decor.dashed;
  const oriented =
    ex.from === aId
      ? {
          a: ex.fromMultiplicity, b: ex.toMultiplicity, portA: ex.fromPort, portB: ex.toPort,
          aSideDecor: exSourceDecor, bSideDecor: exTargetDecor,
        }
      : {
          a: ex.toMultiplicity, b: ex.fromMultiplicity, portA: ex.toPort, portB: ex.fromPort,
          aSideDecor: exTargetDecor, bSideDecor: exSourceDecor,
        };
  return {
    ...oriented,
    length: ex.length,
    label: ex.label,
    linkNote: ex.linkNote,
    dashed: exDashed,
    creationIndex: ex.creationIndex,
  };
}

