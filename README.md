# plantuml-ts

A TypeScript port of [PlantUML](https://plantuml.com), producing SVG
diagrams synchronously in the browser and Node.js with no server
dependency.

## Provenance and Attribution

This project is a **derivative work** of PlantUML. The diagram parsing,
AST design, layout semantics, and rendering rules are ported from the
PlantUML Java source.

**PlantUML**
- Author: Arnaud Roques and contributors
- Source: <https://github.com/plantuml/plantuml>
- License: GNU General Public License v3.0 or later (GPL-3.0-or-later)

The `dot` layout engine (`src/core/dot/`) and the `sfdp`, `fdp`,
`neato`, `twopi`, `circo`, `osage`, and `patchwork` engines are ported
from **Smetana** — PlantUML's auto-generated Java translation of the
Graphviz 2.38.0 C source — and from the original Graphviz algorithms.

**Graphviz**
- Authors: Emden R. Gansner, John C. Ellson, Yifan Hu, and the AT&T
  Research / Lucent Technologies Graphviz team
- Source: <https://gitlab.com/graphviz/graphviz>
- Graphviz 2.38.0 License: Common Public License 1.0 (CPL-1.0)

The algorithms implemented here follow the methods described in:

- Gansner, E. R., Koutsofios, E., North, S. C., & Vo, K.-P. (1993).
  *A technique for drawing directed graphs.* IEEE Transactions on
  Software Engineering, 19(3), 214–230.
- Fruchterman, T. M. J., & Reingold, E. M. (1991). *Graph drawing by
  force-directed placement.* Software: Practice and Experience,
  21(11), 1129–1164.
- Kamada, T., & Kawai, S. (1989). *An algorithm for drawing general
  undirected graphs.* Information Processing Letters, 31(1), 7–15.
- Bruls, M., Huizing, K., & van Wijk, J. J. (2000). *Squarified
  treemaps.* Data Visualization 2000, 33–42.

Modifications relative to the original PlantUML source are recorded
in the Git history of this repository.

## License

Copyright (C) 2024 Scott Seely and contributors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

## Supported Diagram Types

| Diagram | Status |
|---------|--------|
| Sequence | ✓ |
| Class | ✓ |
| Component | ✓ |
| State | ✓ |
| Use Case | ✓ |

### Preprocessor scope

The preprocessor supports `!define`/`!undefine`, conditionals
(`!ifdef`/`!ifndef`/`!else`/`!endif`), `!theme`, and `!procedure`-family
macros. **External import/include functionality (`!import`, `!include`
of local files and the PlantUML stdlib) is not included at this time** —
it is deferred past v1.0 pending a TypeScript/JavaScript-friendly design
for folding in external sources. An opt-in seam for URL-based `!include`
exists (`resolveIncludes()` with a caller-supplied fetcher, see
`src/core/include-resolver.ts`), but no filesystem or stdlib resolution
ships with the library.

## Layout Engines

| Engine | Algorithm |
|--------|-----------|
| `dot` | Sugiyama hierarchical (acyclic → rank → mincross → Brandes-Köpf → splines) |
| `neato` | Kamada-Kawai stress majorization |
| `fdp` | Fruchterman-Reingold spring embedder |
| `sfdp` | Multilevel Fruchterman-Reingold |
| `twopi` | BFS radial |
| `circo` | Circular |
| `osage` | Per-component dot + bin-packing |
| `patchwork` | Squarified treemap |

## Development

```sh
npm install
npm test          # vitest + coverage (90/90/90 thresholds)
npm run typecheck # tsc --noEmit
npm run lint      # eslint src tests demo
npm run build     # vite library build
npm run dev       # demo app (Vite dev server)
```
