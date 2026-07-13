/**
 * Opaque bookmark into a `CodeIterator`'s underlying line list, used by
 * `!while` / `!foreach` to jump back to the top of a loop body. Upstream
 * declares this as an empty marker interface -- any concrete position type
 * satisfies it, and only the `CodeIterator` implementation that produced a
 * given position knows how to interpret it (`CodeIteratorImpl` casts the
 * value back to its own private `Position` record). `unknown` is the
 * faithful TS equivalent of "empty marker interface, opaque to everyone but
 * its producer" -- consistent with this port's existing opaque-stand-in
 * convention (`TMemory.ts`'s `ExecutionContextWhile`/`ExecutionContextForeach`
 * before this batch widened them).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/iterator/CodePosition.java
 */
export type CodePosition = unknown;
