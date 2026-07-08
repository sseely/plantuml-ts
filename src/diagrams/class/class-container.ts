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
): void {
  const segments = splitOnSeparator(id, state.namespaceSeparator);
  if (segments !== null) {
    state.activeNamespace = ensureNamespaceChain(
      state.ast.namespaces,
      state.namespaceSeparator ?? '.',
      segments,
    );
    return;
  }
  state.activeNamespace = id;
  if (state.ast.namespaces.find((n) => n.id === id) === undefined) {
    state.ast.namespaces.push({ id, display, classifiers: [] });
  }
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
