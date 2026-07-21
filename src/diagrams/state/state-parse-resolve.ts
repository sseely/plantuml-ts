/**
 * Name-resolution mechanics for the state parser — split out of
 * `state-parse-state.ts` under the 500-line file cap (mission A4 Phase L
 * iter 10). Owns `ensureState`/`declareState` (the two entry points every
 * command in `state-commands.ts` calls to turn an id into a canonical
 * `State`) and the machinery behind them: flat diagram-wide by-name reuse,
 * and the dotted-id hierarchical-split branch
 * (`resolveOrCreateDottedPath`) ported this iteration.
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#quarkInContextSafe
 */

import type { State, StateKind } from './ast.js';
import {
  type ParseState,
  type Scope,
  type Pass,
  PSEUDOSTATE,
  pseudoKindForId,
  compoundHistoryKind,
  makeState,
  currentScope,
  currentRegionStates,
  rootScope,
  scopeOf,
  nextCreationIndex,
  pseudoTickKey,
  noteScopeId,
} from './state-parse-state.js';
import { stripSyncBarEquals } from './state-transitions.js';

/** True iff `id` should be resolved via the dotted hierarchical-split
 *  branch of `quarkInContextSafe` — the active separator is set (`set
 *  separator none`/`null` disables it entirely) AND `id` actually contains
 *  it. */
function hasSeparator(ps: ParseState, id: string): boolean {
  return ps.separator !== null && id.includes(ps.separator);
}

/**
 * Resolve an id to an ALREADY-EXISTING State it should reuse, per upstream
 * `quarkInContextSafe`'s non-null-separator, no-separator-in-id branch:
 * reuse the SOLE diagram-wide entity with this id when exactly one exists
 * (regardless of which scope/pass created it), otherwise fall back to the
 * CURRENT scope's own local index. Returns `undefined` when no state with
 * this id exists anywhere yet — the caller must create one. Only ever
 * called with an id that does NOT hit the dotted branch (callers route a
 * `hasSeparator` id through `resolveOrCreateDottedPath` first) — matches
 * upstream's `sep==null` branch too (`firstWithName` is likewise an
 * unconditional-match global search; the `set separator none` case is
 * proven functionally identical to the `countByName==1` gate below for
 * undotted ids, since `reuseExistingChild` is `true` at every state-diagram
 * call site — a name's count can never organically exceed 1).
 *
 * Callers are responsible for the id === currentScope.owner.id self-loop
 * check (`CommandLinkStateCommon#getEntity`'s
 * `getCurrentGroup().getName().equals(code)` short-circuit) and for
 * excluding bare `[H]`/`[H*]` shorthand from the global search (see
 * `ensureState`'s doc) — both apply only to specific callers, not to this
 * shared resolver.
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#quarkInContextSafe
 */
function resolveExistingState(ps: ParseState, id: string): State | undefined {
  const globalMatches = ps.globalByName.get(id);
  if (globalMatches !== undefined && globalMatches.length === 1) return globalMatches[0];
  return currentScope(ps).stateIndex.get(id);
}

/**
 * Register a BRAND NEW state into an EXPLICIT target scope: local scope
 * bookkeeping (index/states/region arrays) plus the diagram-wide
 * `globalByName` registry — mirrors upstream `Plasma#register`, which grows
 * the by-name `PEntry` list every quark constructs, regardless of which
 * group it was created under. Only call this for an id that has never been
 * seen in ANY prior pass/visit of `scope`.
 */
function registerStateInto(ps: ParseState, scope: Scope, state: State): void {
  // mission G4 S7: the SINGLE true "brand new state" chokepoint -- every
  // creation path (declare, dotted-path, history/deepHistory shorthand,
  // compound-history graft, transition-endpoint auto-create) funnels through
  // here exactly once per state, in true parse-time order. See `State
  // .creationIndex`'s own doc comment (ast.ts) for the full mechanism.
  state.creationIndex = nextCreationIndex(ps);
  scope.stateIndex.set(state.id, state);
  scope.states.push(state);
  currentRegionStates(scope).push(state);

  const entries = ps.globalByName.get(state.id);
  if (entries !== undefined) entries.push(state);
  else ps.globalByName.set(state.id, [state]);
}

/**
 * Register a BRAND NEW state into the CURRENT scope — thin wrapper over
 * `registerStateInto` for the (common) non-dotted creation path. Because
 * the scope tree is PERSISTENT (`ParseState.scopeByOwner`), an id that
 * already exists must NOT be re-registered here on a later pass/visit — it
 * is already present in its owning scope's arrays from the visit that
 * first created it.
 */
function registerNewState(ps: ParseState, state: State): void {
  registerStateInto(ps, currentScope(ps), state);
}

/**
 * Resolve (or create) the State at the end of a DOTTED id's hierarchical
 * path — upstream `quarkInContextSafe`'s `full.indexOf(sep) != -1` branch
 * (`CucaDiagram.java:263-284`) + `Quark#child`'s per-segment walk
 * (`plasma/Quark.java:116-132`). Each segment becomes (or reuses) a DIRECT
 * child of the previous segment's own scope, auto-creating any missing
 * intermediate composite along the way.
 *
 * Anchor selection mirrors upstream exactly: if the id's FIRST segment
 * already exists as a genuine TOP-LEVEL state (`this.root.childIfExists`),
 * the WHOLE path resolves relative to the diagram ROOT, regardless of the
 * CURRENT parsing scope — this is what lets a top-level transition
 * (`Somp.entry1`, written outside any block) reach into an
 * already-declared composite's children. Otherwise the path resolves
 * relative to the CURRENT scope (`currentQuark.child(full)`) — new,
 * scope-local nesting (mission A4 Phase L iter 10's fugedo-34-fice721:
 * a dotted reference whose first segment is a SIBLING, not a root-level
 * or current-scope entity, auto-creates a brand new nested duplicate
 * instead of reaching across — a genuine upstream parse-error case in that
 * fixture, ledgered separately, not fixed here).
 *
 * The FINAL segment itself is NEVER marked phantom or upgraded (it is the
 * thing actually being declared/referenced) regardless of caller — see
 * `DottedAncestorMode`'s doc for what each `mode` does to the ANCESTOR
 * segments along the way.
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#quarkInContextSafe
 * @see ~/git/plantuml/.../plasma/Quark.java#child
 */
/**
 * Which auto-promotion a dotted path's NEWLY-created (or already-existing)
 * ANCESTOR segments get, keyed to the THREE distinct upstream call sites:
 *  - `'phantom'` — composite/frame BLOCK opener (rule 6/7). New ancestors
 *    become `autoPhantom` (`GroupType.PACKAGE`); an existing ancestor is
 *    left exactly as-is (never re-flagged either direction).
 *  - `'promote'` — LEAF-style declare (rule 8/9, `CommandCreateState`).
 *    Mirrors upstream `ensureParentState`: new ancestors are ordinary
 *    (never phantom), and an EXISTING still-phantom ancestor is upgraded
 *    in place (flag cleared) — `ensureParentState` permanently promotes
 *    any ancestor it walks through.
 *  - `'neutral'` — transition-endpoint resolution (`ensureState`). Upstream
 *    `CommandLinkStateCommon#getEntity` never calls `ensureParentState` at
 *    all; a brand-new ancestor is just ordinary (no fixture in the corpus
 *    exercises this path creating a genuinely NEW ancestor — the one that
 *    does, fugedo-34-fice721, is an upstream parse-error case, ledgered
 *    separately), and an existing ancestor's flag is left untouched either
 *    way.
 */
type DottedAncestorMode = 'phantom' | 'promote' | 'neutral';

function resolveOrCreateDottedPath(ps: ParseState, segments: readonly string[], mode: DottedAncestorMode): State {
  const anchorIsRoot = rootScope(ps).stateIndex.has(segments[0]!);
  let scope: Scope = anchorIsRoot ? rootScope(ps) : currentScope(ps);
  let state: State | undefined;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const isLast = i === segments.length - 1;
    const existing = scope.stateIndex.get(seg);
    if (existing !== undefined) {
      if (!isLast && mode === 'promote') delete existing.autoPhantom;
      state = existing;
    } else {
      state = makeState(seg, seg, 'normal', !isLast && mode === 'phantom' ? { autoPhantom: true } : undefined);
      registerStateInto(ps, scope, state);
    }
    scope = scopeOf(ps, state);
  }
  return state!;
}

/**
 * Ensure a named state exists, resolving it diagram-wide when its id is
 * globally unique. '[*]' is never auto-created as a State node. '[H]',
 * '[H*]', and '==name==' (2-or-more '=' each side) are auto-created as
 * history/deepHistory/syncBar pseudostates respectively (sync bars under
 * their CANONICAL stripped name -- see `stripSyncBarEquals`).
 *
 * Resolution order (mirrors `CommandLinkStateCommon#getEntity` +
 * `CucaDiagram#quarkInContextSafe`):
 *   1. An id equal to the CURRENTLY OPEN composite's own name self-loops to
 *      that composite (`getCurrentGroup().getName().equals(code)`) — this
 *      check happens at the CALLER (`getEntity`), before `quarkInContext`
 *      is even reached, so it takes priority over every other rule. Upstream
 *      compares against `getCurrentGroup().getName()` -- the quark's LOCAL
 *      (unqualified) segment name, not its full qualified id -- so for a
 *      DOTTED id this comparison is always against a shorter local segment,
 *      never the full dotted string; excluded here for the same reason.
 *      The hierarchical walk below independently converges dotted
 *      self-references (`state S.I { S.I --> S.I }`) back onto the SAME
 *      currently-open entity anyway (verified against the oracle,
 *      tuvugi-94-gapi519) — just via full-path resolution landing on it,
 *      not this fast local-name shortcut.
 *   2. Bare `[H]`/`[H*]` shorthand resolves to a SYNTHETIC composite-
 *      namespaced id (`ensureHistoryShorthand`/`historicalId`,
 *      `"*historical*"/"*deephistory*" + groupName`, mission A4 Phase L
 *      iter 14) mirroring `StateDiagram#getHistorical`/`getDeepHistory`'s
 *      0-arg overload exactly, instead of the literal bracket text — two
 *      different composites' own bare `[H]`/`[H*]` are always DISTINCT
 *      entities even though the SOURCE TEXT is identical. `=name=` sync
 *      bars are NOT namespaced this way — upstream calls `quarkInContext`
 *      directly for them with no synthetic-id wrapping, so a same-named
 *      sync bar genuinely IS meant to be diagram-wide.
 *   3. Compound `StateId[H]`/`StateId[H*]` resolves via
 *      `ensureCompoundHistory`, the `getHistorical`/`getDeepHistory`
 *      2-arg overload: `StateId` resolves/creates as an ordinary state,
 *      then the SAME synthetic id from point 2 is grafted directly INTO
 *      that composite's own scope (reusing its bare `[H]`/`[H*]` child if
 *      it already declared one).
 *   4. A dotted id (active separator, `hasSeparator`) resolves/creates via
 *      the hierarchical walk (`resolveOrCreateDottedPath`), ancestors
 *      promoted to ordinary (non-phantom) composites — mission A4 Phase L
 *      iter 10.
 *   5. Otherwise, the shared `resolveExistingState` diagram-wide/scope-local
 *      resolution applies; if nothing exists yet, create a new state in the
 *      CURRENT scope and register it (both locally and diagram-wide). This
 *      is only reachable from pass-TWO transitions or pass-ONE standalone
 *      description lines (each a single-pass-eligible caller — see
 *      `Pass`'s doc), so there is no cross-pass double-creation risk.
 * @see ~/git/plantuml/.../statediagram/command/CommandLinkStateCommon.java#getEntity
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#quarkInContextSafe
 */
function isHistoryShorthandKind(pseudoKind: StateKind | undefined): boolean {
  return pseudoKind === 'history' || pseudoKind === 'deepHistory';
}

/** Synthetic composite-namespaced history/deepHistory id -- upstream
 *  `StateDiagram#getHistorical`/`getDeepHistory`'s `"*historical*" +
 *  groupName` / `"*deephistory*" + groupName` (root scope: no suffix at
 *  all, `groupId` passed as `''`). Shared by the bare shorthand and the
 *  compound `StateId[H]`/`StateId[H*]` form below -- both canonicalize to
 *  the IDENTICAL id for the same owning composite, so a composite that
 *  declares its own bare `[H]` AND is also referenced via `Other -->
 *  Comp[H]` gets exactly one history node, reused by both (jar-verified:
 *  `"*historical*" + g.getName()` depends only on the CURRENT group, never
 *  on which call site produced it).
 * @see ~/git/plantuml/.../statediagram/StateDiagram.java#getHistorical
 * @see ~/git/plantuml/.../statediagram/StateDiagram.java#getDeepHistory
 */
function historicalId(pseudoKind: StateKind, groupId: string): string {
  return (pseudoKind === 'deepHistory' ? '*deephistory*' : '*historical*') + groupId;
}

/** Bare `[H]`/`[H*]` shorthand -- scope-local ONLY (`ensureState`'s doc,
 *  point 2). A composite's own literal id is NEVER reused directly (that
 *  collided across sibling composites -- two DIFFERENT composites each
 *  declaring their own bare `[H]` produced two DISTINCT `State` objects
 *  that nonetheless shared the string id `'[H]'`, corrupting every
 *  id-keyed consumer downstream: `subtreeIds`/`isAutarkic`'s whole-diagram
 *  boundary-crossing check saw a transition's endpoint as simultaneously
 *  "inside" whichever sibling composite's subtree also happened to declare
 *  a `[H]`, and the DOT-node-id assignment emitted the SAME synthetic node
 *  id into two different clusters. Verified: movuva-53-jude799/
 *  pasosa-28-zudu135 (`Playing1`'s own `[H]` colliding with `State2`'s own
 *  `[H]` wrongly disqualified `Playing1` from autonom -- oracle 2 passes,
 *  ours 1, both sibling composites' content flattened into one cluster
 *  pass with a DUPLICATE `sh000N` node id spanning both `subgraph`
 *  blocks). Factored out to keep `ensureState`'s own CCN under the
 *  complexity cap. */
function ensureHistoryShorthand(ps: ParseState, pseudoKind: StateKind): State {
  const owner = currentScope(ps).owner;
  const canonicalId = historicalId(pseudoKind, owner === null ? '' : owner.id);
  const existing = currentScope(ps).stateIndex.get(canonicalId);
  if (existing !== undefined) return existing;
  const s = makeState(canonicalId, canonicalId, pseudoKind);
  registerNewState(ps, s);
  ps.lastEntity = canonicalId;
  return s;
}

/**
 * Compound `StateId[H]`/`StateId[H*]` endpoint -- `StateDiagram
 * #getHistorical(location, idShort)`/`getDeepHistory(location, idShort)`:
 * resolve-or-create `idShort` as an ordinary state (upstream's direct
 * `quarkInContext` call, NOT routed back through `getEntity` -- so no
 * self-loop/history/dotted special-casing applies to `idShort` itself,
 * mirrored here via the shared `resolveExistingState` + create-in-current-
 * scope tail, same as `ensureState`'s own generic branch), then
 * resolve-or-create the history node INSIDE that composite's own
 * (possibly not-yet-existing, possibly already-closed) scope --
 * upstream's `gotoGroup(...)`/`endGroup()` bracket, ported here as a
 * direct `scopeOf`+`registerStateInto` graft (see `syncAutoScopes`'s doc,
 * state-parse-state.ts, for why grafting into an ALREADY-CLOSED scope is
 * still picked up correctly at end-of-parse). A brand-new `idShort`
 * becomes an ordinary state in the CURRENT scope, exactly like any other
 * forward reference -- it then immediately gains one child (the history
 * node), making it a composite where it previously would not have been
 * one (nenita-48-zuze128/vubale-26-daza585: `a[H]`/`a[H*]` reference a
 * name declared nowhere else).
 * @see ~/git/plantuml/.../statediagram/StateDiagram.java#getHistorical(LineLocation,String)
 * @see ~/git/plantuml/.../statediagram/StateDiagram.java#getDeepHistory(LineLocation,String)
 */
function ensureCompoundHistory(ps: ParseState, idShort: string, pseudoKind: StateKind): State {
  let composite = resolveExistingState(ps, idShort);
  if (composite === undefined) {
    composite = makeState(idShort, idShort, 'normal');
    registerNewState(ps, composite);
  }
  const scope = scopeOf(ps, composite);
  const canonicalId = historicalId(pseudoKind, composite.id);
  const existing = scope.stateIndex.get(canonicalId);
  if (existing !== undefined) return existing;
  const s = makeState(canonicalId, canonicalId, pseudoKind);
  registerStateInto(ps, scope, s);
  ps.lastEntity = canonicalId;
  return s;
}

export function ensureState(
  ps: ParseState,
  id: string,
  kind: StateKind = 'normal',
  isFrom?: boolean,
): State | undefined {
  // mission G4 S7: `'[*]'` is never a real `State` node (unchanged), but
  // upstream's own `getStart(location)`/`getEnd(location)` DOES lazily
  // construct a real (ticked) `Entity` the FIRST time a scope references it
  // -- `isFrom` distinguishes which one (a `[*]` written as a transition's
  // `from` resolves `getStart`; as `to`, `getEnd`), matching the call site's
  // own `ensureState(ps, rest.from, undefined, true)`/`ensureState(ps,
  // rest.to, undefined, false)`. Idempotent per scope (memoized in
  // `ps.pseudoCreationIndex`), mirroring `quark.getData() == null` guarding
  // `reallyCreateLeaf` inside `getStart`/`getEnd`. `isFrom === undefined`
  // (every OTHER caller, none of which can pass the literal `'[*]'` token)
  // skips this entirely -- see `Transition.creationIndex`'s own doc comment.
  if (id === PSEUDOSTATE) {
    if (isFrom !== undefined) {
      const key = pseudoTickKey(noteScopeId(ps), isFrom ? 'start' : 'end');
      if (!ps.pseudoCreationIndex.has(key)) ps.pseudoCreationIndex.set(key, nextCreationIndex(ps));
    }
    return undefined;
  }

  // Sync-bar ids resolve/create under their CANONICAL stripped name (`B1`,
  // not `==B1==`/`===B1===`) -- upstream's `removeEquals()` runs before the
  // `quarkInContext` lookup, so the `=`-count is not part of the entity's
  // identity (jar-verified: `==B1==` and `===B1===` unify to one entity).
  // See `stripSyncBarEquals`'s doc comment.
  const pseudoKind = pseudoKindForId(id);
  const canonicalId = pseudoKind === 'syncBar' ? stripSyncBarEquals(id) : id;

  const owner = currentScope(ps).owner;
  const dotted = hasSeparator(ps, canonicalId);
  if (owner !== null && !dotted && owner.id === canonicalId) return owner;

  if (isHistoryShorthandKind(pseudoKind)) return ensureHistoryShorthand(ps, pseudoKind!);

  const compound = compoundHistoryKind(canonicalId);
  if (compound !== undefined) return ensureCompoundHistory(ps, compound.idShort, compound.kind);

  if (dotted) {
    const state = resolveOrCreateDottedPath(ps, canonicalId.split(ps.separator!), 'neutral');
    ps.lastEntity = state.id;
    return state;
  }

  const existing = resolveExistingState(ps, canonicalId);
  if (existing !== undefined) return existing;

  const s = makeState(canonicalId, canonicalId, pseudoKind ?? kind);
  registerNewState(ps, s);
  ps.lastEntity = canonicalId;
  // #lizard forgives -- CCN 11: faithful port of CommandLinkStateCommon#getEntity's
  // real branch count (self-loop / history / dotted / sync-bar canonicalization /
  // existing / create), not incidental complexity.
  return s;
}

/** Apply a declaration's content (display/kind/color/stereotype/container/
 *  tags) onto the CANONICAL target state — shared by `declareState`'s
 *  dotted and flat branches. Gated to pass `'one'` only, mirroring
 *  upstream's `if (currentPass == ParserPass.ONE) { ent.setDisplay(...);
 *  ... }` guard inside `CommandCreateState`/`CommandCreatePackageState`
 *  (both structurally eligible for EVERY pass, but only apply their content
 *  side effects once). */
function applyDeclaredContent(target: State, source: State, pass: Pass): void {
  if (pass !== 'one') return;
  target.display = source.display;
  target.kind = source.kind;
  if (source.color !== undefined) target.color = source.color;
  if (source.stereotype !== undefined) target.stereotype = source.stereotype;
  if (source.container !== undefined) target.container = source.container;
  // Tags ACCUMULATE (upstream `Entity#addStereotag` adds into a `Set`, so a
  // re-declaration's tags join the earlier ones instead of replacing them —
  // matches class-declaration-parser.ts's identical precedent).
  if (source.tags !== undefined && source.tags.length > 0) {
    target.tags = [...new Set([...(target.tags ?? []), ...source.tags])];
  }
}

/**
 * Add an explicitly declared state (overrides auto-created entry). Returns
 * the CANONICAL State object backing this id — the pre-existing object
 * when one already exists (auto-created by an earlier transition
 * reference, e.g. `Run --> Stop` before `state Run{`, a diagram-wide-unique
 * entity declared/referenced in a DIFFERENT scope, OR — on pass TWO — this
 * SAME declaration having already run during pass ONE), or `state` itself
 * when this id has never been seen before. Callers that go on to
 * `pushScope` (composite/frame openers) MUST push the returned object, not
 * their own throwaway `state` — pushing the throwaway orphans the block's
 * children (popScope writes `owner.children`, and only the CANONICAL object
 * is reachable from the tree afterwards). This was a real bug caught during
 * mission A4/T4: every fixture referencing a composite as a transition
 * endpoint before its own `{ }`/`begin` block silently dropped that
 * composite's entire body.
 *
 * `opts.phantomAncestors` selects which auto-promotion a dotted id's
 * INTERMEDIATE ancestors get (mission A4 Phase L iter 10,
 * `resolveOrCreateDottedPath`'s doc): `true` for composite/frame BLOCK
 * openers (rule 6/7, `GroupType.PACKAGE` — never autonom), `false`
 * (default) for LEAF-style declares (rule 8/9, `GroupType.STATE` —
 * autonom-eligible, upstream `ensureParentState`).
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#quarkInContextSafe
 * @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java (ParserPass.ONE gate)
 */
export function declareState(
  ps: ParseState,
  state: State,
  pass: Pass,
  opts?: { phantomAncestors?: boolean },
): State {
  if (hasSeparator(ps, state.id)) {
    const resolved = resolveOrCreateDottedPath(
      ps,
      state.id.split(ps.separator!),
      opts?.phantomAncestors === true ? 'phantom' : 'promote',
    );
    applyDeclaredContent(resolved, state, pass);
    ps.lastEntity = resolved.id;
    return resolved;
  }

  const existing = resolveExistingState(ps, state.id);
  if (existing !== undefined) {
    applyDeclaredContent(existing, state, pass);
    ps.lastEntity = existing.id;
    return existing;
  }
  registerNewState(ps, state);
  ps.lastEntity = state.id;
  return state;
}

/**
 * Resolve the target State for a standalone `CODE : text` description line
 * (CommandAddField): the CURRENT scope's own composite (self-reference,
 * `state Foo { Foo : text }`) if the id matches its owner, otherwise an
 * existing-or-auto-created state in the current scope.
 * @see ~/git/plantuml/.../statediagram/command/CommandAddField.java:92-100
 */
export function resolveDescriptionTarget(ps: ParseState, code: string): State | undefined {
  const owner = currentScope(ps).owner;
  if (owner !== null && owner.id === code) return owner;
  return ensureState(ps, code);
}
