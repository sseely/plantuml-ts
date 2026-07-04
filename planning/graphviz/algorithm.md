# Graphviz dot Algorithm — Pipeline Overview

## Pipeline

```
Input graph (nodes + edges + attributes)
        │
        ▼
┌─────────────────┐
│  1. Acyclic     │  Remove cycles by reversing selected edges
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. Rank        │  Assign integer rank to each node (network simplex)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. Mincross    │  Order nodes within each rank to minimize crossings
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  4. Position    │  Assign x-coordinates (Brandes-Köpf)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  5. Splines     │  Route edges as Bezier splines through bend points
└────────┬────────┘
         │
         ▼
Output geometry (x, y, width, height per node; point lists per edge)
```

Corresponds to Smetana's `dotinit__c.java` call sequence:
```java
dot_rank(g, sameRanks, GD_n_cluster(g), ngnodes, ngnedges)
dot_mincross(g, 1)
dot_position(g, 1)
dot_sameports(g)
dot_splines(g)
```

---

## Stage 1: Acyclic (`acyclic__c.java`)

**Goal:** Make the graph a DAG (directed acyclic graph) by reversing
a minimal set of back edges.

**Method:** DFS-based cycle detection. When a back edge is found, mark it
reversed. Reversed edges are flipped for layout but restored before output
(so edge direction is preserved in the final result).

**Key data added to working graph:**
- `edge.reversed: boolean` — edge was flipped to break cycle

**Reference:** `acyclic__c.java` (146 lines)

---

## Stage 2: Rank (`rank__c.java`)

**Goal:** Assign each node an integer rank (0, 1, 2, ...) such that for
every edge u→v, `rank(v) = rank(u) + weight`. Minimizes total edge length
(sum of rank differences across all edges).

**Method:** Network simplex algorithm.
1. Initial feasible tree via DFS
2. Compute cut values for all tree edges
3. Iteratively replace negative-cut-value tree edges with non-tree edges
   that improve the objective
4. Normalize ranks to start at 0

**Key data added to working graph:**
- `node.rank: number` — assigned rank
- `edge.cutValue: number` — network simplex cut value (internal)
- Virtual nodes added for edges that span multiple ranks (long edges)

**Reference:** `rank__c.java` (785 lines)

---

## Stage 3: Mincross (`mincross__c.java`)

**Goal:** Order nodes within each rank layer to minimize edge crossings
between adjacent layers.

**Method:** Barycentric heuristic with multiple passes.
1. Set initial order (DFS-based)
2. Alternate forward and backward passes:
   - For each node, compute barycenter = average rank of neighbors in adjacent layer
   - Sort nodes within layer by barycenter
3. Count crossings; keep best ordering found across all passes

**Key data added to working graph:**
- `node.order: number` — position within its rank layer
- `rank[r].nodes: Node[]` — ordered node list per rank

**Reference:** `mincross__c.java` (2,003 lines)

---

## Stage 4: Position (`position__c.java`)

**Goal:** Assign x-coordinates to nodes using their rank (y) and order
(x) assignments from previous stages.

**Method:** Brandes-Köpf algorithm.
1. Mark "type-1 conflicts" (non-inner segments that cross inner segments)
2. Four alignment passes (top-left, top-right, bottom-left, bottom-right)
3. Compact each alignment horizontally
4. Average the four alignments; shift to x≥0

**Key data added to working graph:**
- `node.x: number` — horizontal coordinate
- `node.y: number` — vertical coordinate (derived from rank × (nodeHeight + rankSep))

**Reference:** `position__c.java` (1,954 lines)

---

## Stage 5: Splines (`dotsplines__c.java`)

**Goal:** Route edges as smooth Bezier curves that avoid nodes.

**Method:**
1. For short edges (adjacent ranks): route straight or with one bend
2. For long edges (virtual node chains): reconstruct path through virtual
   node positions, then fit a Bezier spline
3. Self-loops: circular arc off the node boundary
4. Apply label placement along each edge

**Output per edge:**
- `edge.points: Point[]` — control points for Bezier path `d` attribute

**Reference:** `dotsplines__c.java` (2,391 lines)

---

## Working Graph Data Model

```typescript
interface DotNode {
  id: string;
  width: number;
  height: number;
  // Set by rank stage:
  rank: number;
  // Set by mincross stage:
  order: number;
  // Set by position stage:
  x: number;
  y: number;
  // Internal: virtual nodes created for long edges
  virtual?: boolean;
}

interface DotEdge {
  id: string;
  from: string; // DotNode id
  to: string;   // DotNode id
  // Set by acyclic stage:
  reversed: boolean;
  // Set by rank stage:
  weight: number;
  minLen: number;
  // Set by splines stage:
  points: Array<{ x: number; y: number }>;
  // Virtual edges for long-edge chains
  virtualEdges?: DotEdge[];
}

interface DotGraph {
  nodes: DotNode[];
  edges: DotEdge[];
  // Layout parameters
  rankDir: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSep: number;   // horizontal spacing between nodes in same rank
  rankSep: number;   // vertical spacing between ranks
}
```

---

## Output Format

```typescript
interface DotLayoutResult {
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  edges: Array<{
    id: string;
    points: Array<{ x: number; y: number }>;
  }>;
  width: number;
  height: number;
}
```

This matches the existing `ElkLayoutResult` shape (D5), so renderers
need no changes.
