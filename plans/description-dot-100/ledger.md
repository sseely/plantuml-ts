# description-dot-100 ledger

(entries appended per loop-protocol format as iterations close)

## stdlib bundle includes (no-candidate: we render StdlibNotBundledError, no DOT)
- Mechanism: `!include <bundle/...>` is a typed error pending SI5b stdlib
  bundling (DIVERGENCES.md § "`!include <bundle/thing>` is a typed error");
  the diagram becomes an error diagram, feeds no DOT, and sits in the
  no-candidate bucket while the oracle has svek-1.dot for all six.
  (Java: preprocessing stdlib resolution inside the jar; ours:
  src/core/tim include store, StdlibNotBundledError)
- Disposition: **blocked-on SI5b / needs-signoff** — the licensing ruling is
  still awaited, AND two of the required bundles (`bootstrap`, `cloudogu`)
  are outside the S4 audit's top-5, so SI5b as currently scoped would still
  leave 3 of these 6 blocked pending a bundle-audit extension.
- Slugs: component xusuxe-62-guba767 (cloudogu); usecase fariba-82-xolu802
  (awslib), kofuca-08-pafi749 (awslib14), ruziru-69-xixo434 (bootstrap),
  bootstrap-0 (bootstrap), vivido-49-nisu863 (tupadr3)

## deliberately unported under this mission (comparator-invisible / out of check)
- kermor Link constraint=false on port-mismatched edges (Link.java:139-141)
  — no comparator-observed attribute; revisit at G1 (I2 journal row).
- SVG-side arrow labels still render raw [[...]] markup — DOT-invisible;
  G1 item (I5 journal row).
- Quark sep==null global firstWithName merge fallback
  (CucaDiagram.java:251-253) — unreachable with `set separator` active;
  no fixture exercises it (I1b journal row).
