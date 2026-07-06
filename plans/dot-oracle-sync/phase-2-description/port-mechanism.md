# Port (EntityPosition) DOT mechanism

Verified against banatu-09-koce254 / bijoko-90-riro507 oracle dumps.

## Upstream model

- `abel/EntityPosition.java`: `port`/`portin`/`portout` declarations inside a
  container are leaves with EntityPosition ≠ NORMAL; they sit on the cluster
  border.
- `svek/ClusterDotString.java:134-184` (ports branch):
  1. Cluster attrs keep `labeljust="c"` but drop the `label=` attr — the
     title table moves onto the ee-placeholder below.
  2. `printRanks`: `{rank=source;<portin shs>;}` and `{rank=sink;<portout
     shs>;}` emitted as the FIRST content inside the cluster braces
     (anonymous brace groups — these are part of the oracle's byte shape and
     make the comparator's brace scan treat both sides identically).
  3. Port node lines: `SvekNode.appendLabelHtmlSpecialForPort` — label wider
     than 40px → `shape=plaintext` HTML table with a 12×12 `PORT="P"` cell and
     shield-like flanking pads; otherwise the basic form: a plain
     `shape=rect` 12×12 (0.166667 in).
  4. Bare constraint chains: `shA->shB [arrowhead=none];` per rank then
     `shLast->zaentN;` (bracket-less — the comparator's edge regex requires
     `[...]`, so these count on neither side).
  5. `subgraph clusterNee {label="";` wraps the `empty()` placeholder —
     `zaentN [shape=rect,width=.01,height=.01,label=<title TABLE>]` (reuses
     the group-anchor id) — plus the cluster's normal members.
- Edges to/from a port entity reference `shN:P` (Link.getEntityPort →
  EntityPort.forPort).

## Ours

Layout marks port leaves (`isPort`, `portPad`, per-cluster `portRanks` +
`portAnchorId`, `titleLabelWidth/Height` on the anchor); the svek emitter
reproduces the exact ClusterDotString text shape (portClusterBlock in
src/core/svek-dot-emit.ts). Top-level rank groups suppress port ids (their
ranks live in the in-cluster groups).

## Known residual

- bujige-52-gase998: `set separator .` + qualified references (`srv1.br0`)
  — separator/qualified-name addressing is a distinct unimplemented
  mechanism (ledgered).
