/**
 * Descriptive-container helpers for the class parser. A descriptive container
 * (`rectangle`/`component`/`stack`/… opened with a `{` body — upstream
 * CommandPackageWithUSymbol) groups like a package when it has children (a
 * cluster), but an EMPTY one renders as a plain rect box, unlike an empty
 * `package` which vanishes at THIS (parse-time) chokepoint. `closeContainer`
 * performs that empty→leaf conversion when the block closes.
 *
 * A plain `package`/`namespace` is NOT collapsed here, deliberately: unlike a
 * descriptive container (which cannot be reopened by name after its `}`), a
 * dotted namespace path CAN be reopened by a later block adding real content
 * under it (`namespace f1 {}` … `namespace f1.function { class Fox }` — `f1`
 * is empty at ITS OWN close, not empty once `f1.function` exists under it).
 * Collapsing `f1` eagerly here would strand it as a classifier while a LATER
 * `ensureNamespaceChain` call for `f1.function` recreates a fresh, disconnected
 * `f1` namespace — a stray duplicate node with no way to reconcile the two
 * without re-scanning the whole array. Confirmed via regression on the oracle
 * DOT for delano-03-xino845/faxoga-34-moja699/jabeme-35-logi109 (all reopen a
 * previously-empty-closed namespace) when this collapse was broadened to
 * plain containers. The general (reopen-safe) collapse for plain
 * `package`/`namespace` instead runs ONCE on the fully-parsed AST, at the
 * layout-input boundary — see `collapseEmptyNamespacesFinal`
 * (class-namespace.ts), called from `layout.ts` alongside
 * `filterRemovedEntities` — mirroring upstream's real timing:
 * `GraphvizImageBuilder#printGroups` (svek/GraphvizImageBuilder.java:406-419)
 * mutes an empty `GroupType.PACKAGE` to `LeafType.EMPTY_PACKAGE` at
 * DOT-export time, on the complete diagram model, not per-block-close.
 */
import type { ParseState } from './parser.js';
import {
  splitOnSeparator,
  ensureNamespaceChain,
  collapseEmptyNamespace,
} from './class-namespace.js';

/**
 * Open a `package`/`namespace`/descriptive-container block: mark it the active
 * container, splitting a dotted name into a nested chain. All map to the same
 * GroupType.PACKAGE container upstream; the USymbol difference does not affect
 * DOT cluster structure.
 */
export function openNamespaceBlock(
  state: ParseState,
  id: string,
  display: string,
): string {
  // Restore point for the enclosing container on the matching `}`.
  const enclosing = state.activeNamespace;
  state.namespaceStack.push(enclosing);

  // A bare id opened inside another container is qualified under it, so the
  // existing dotted-namespace machinery builds the nested cluster (parentIds).
  const sep = state.namespaceSeparator ?? '.';
  const effectiveId =
    enclosing !== null && !id.includes(sep) ? enclosing + sep + id : id;

  const segments = splitOnSeparator(effectiveId, state.namespaceSeparator);
  if (segments !== null) {
    state.activeNamespace = ensureNamespaceChain(
      state.ast.namespaces,
      sep,
      segments,
    );
    return state.activeNamespace;
  }
  state.activeNamespace = effectiveId;
  if (state.ast.namespaces.find((n) => n.id === effectiveId) === undefined) {
    state.ast.namespaces.push({ id: effectiveId, display, classifiers: [] });
  }
  return effectiveId;
}

/**
 * On `}` close of the namespace `nsId`: if it is an EMPTY descriptive container,
 * drop the (member-less) namespace and add a `descriptive` rect-leaf classifier
 * in its place, carrying the container's USymbol. A non-empty descriptive
 * container is left as a cluster. A no-op for any other container kind (plain
 * `package`/`namespace`) — see the file doc for why that collapse is deferred
 * to `collapseEmptyNamespacesFinal`. Delegates the actual collapse to
 * `collapseEmptyNamespace` (class-namespace.ts), shared with the same-line
 * `X {}` path.
 */
/** `together {` (CommandTogether → CucaDiagram#gotoTogether,
 *  CucaDiagram.java:337): a layout-proximity grouping with NO structural DOT
 *  cluster of its own that the comparator counts (svek emits a letter-suffixed
 *  `cluster6t0` subgraph the parity bar ignores) — members still belong to the
 *  enclosing namespace. Records the namespace active at open time so the
 *  matching `}` pops the together, not that namespace (nadono-22-gidu983: the
 *  stray `}` popped the enclosing namespace early, stranding later
 *  classifiers outside its cluster). */
export function openTogetherBlock(state: ParseState): void {
  state.togetherStack.push(state.activeNamespace);
}

/** Shared `}` handling (rule 4 in class-commands.ts, pure move): an open
 *  member body wins, then an innermost together block (one opened in the
 *  CURRENT namespace scope — LIFO, mirroring upstream's single
 *  CucaDiagram.stacks list holding Together and group entries), then the
 *  active namespace. */
export function closeBraceScope(state: ParseState): void {
  if (state.pendingBodyId !== null) {
    state.pendingBodyId = null;
    return;
  }
  if (
    state.togetherStack.length > 0 &&
    state.togetherStack[state.togetherStack.length - 1] === state.activeNamespace
  ) {
    state.togetherStack.pop();
    return;
  }
  if (state.activeNamespace !== null) {
    closeContainer(state, state.activeNamespace);
    state.activeNamespace = state.namespaceStack.pop() ?? null;
  }
}

export function closeContainer(state: ParseState, nsId: string): void {
  const usymbol = state.descriptiveContainers.get(nsId);
  if (usymbol === undefined) return;
  const ns = state.ast.namespaces.find((n) => n.id === nsId);
  if (ns === undefined || ns.classifiers.length > 0) return;

  state.ast.namespaces = collapseEmptyNamespace(
    state.ast.namespaces,
    state.classifierIndex,
    state.ast.classifiers,
    nsId,
  );
  const idx = state.classifierIndex.get(nsId);
  if (idx !== undefined) state.ast.classifiers[idx]!.usymbol = usymbol;
}
