/**
 * Descriptive-container helpers for the class parser. A descriptive container
 * (`rectangle`/`component`/`stack`/… opened with a `{` body — upstream
 * CommandPackageWithUSymbol) groups like a package when it has children (a
 * cluster), but an EMPTY one renders as a plain rect box, unlike an empty
 * `package` which vanishes. `closeContainer` performs that empty→leaf conversion
 * when the block closes.
 */
import type { ParseState } from './parser.js';
import {
  makeClassifier,
  splitOnSeparator,
  ensureNamespaceChain,
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
 * in its place. A non-empty descriptive container is left as a cluster.
 */
export function closeContainer(state: ParseState, nsId: string): void {
  const usymbol = state.descriptiveContainers.get(nsId);
  if (usymbol === undefined) return;
  const ns = state.ast.namespaces.find((n) => n.id === nsId);
  if (ns === undefined || ns.classifiers.length > 0) return;

  state.ast.namespaces = state.ast.namespaces.filter((n) => n.id !== nsId);
  const parentId = ns.parentId ?? null;
  const classifier = makeClassifier(nsId, 'descriptive', ns.display, parentId);
  classifier.usymbol = usymbol;
  state.classifierIndex.set(nsId, state.ast.classifiers.length);
  state.ast.classifiers.push(classifier);
  if (parentId !== null) {
    state.ast.namespaces.find((n) => n.id === parentId)?.classifiers.push(nsId);
  }
}
