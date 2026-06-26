# T11 — Sequence diagram box/end box

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js TypeScript port. PlantUML sequence diagrams support
`box "Label" #color ... end box` to draw a colored background
rectangle behind a group of participants with an optional label
at the top. Common in enterprise sequence diagrams. Not yet in
the AST or parser.

Upstream syntax:
```
box "System A" #LightBlue
  participant Alice
  participant Bob
end box
```

The box spans from the leftmost to rightmost contained participant
(center ± half width + padding). The label appears inside the box
at the top-left.

## Task

1. Add `BoxGroup` to `src/diagrams/sequence/ast.ts`: participants
   may carry an optional `boxId: string`; add a `boxes` array to
   `SequenceDiagramAST` with `{ id, label, color, participantIds }`
2. Parse `box`/`end box` in `src/diagrams/sequence/parser.ts`
3. Compute box geometry in `src/diagrams/sequence/layout.ts`:
   `BoxGeo { x, y, width, height, label, color }` covering the
   full lifeline span of contained participants
4. Render box backgrounds in `src/diagrams/sequence/renderer.ts`
   as `<rect>` drawn before participants (behind them in z-order)

Consult `~/git/plantuml/src/main/java/net/sourceforge/plantuml/sequencediagram/`
for upstream semantics.

## Write-set

- `src/diagrams/sequence/ast.ts`
- `src/diagrams/sequence/parser.ts`
- `src/diagrams/sequence/layout.ts`
- `src/diagrams/sequence/renderer.ts`
- `tests/unit/sequence/parser.test.ts`
- `tests/unit/sequence/renderer.test.ts`

## Read-set

- `src/diagrams/sequence/ast.ts`
- `src/diagrams/sequence/parser.ts`
- `src/diagrams/sequence/layout.ts`
- `src/diagrams/sequence/renderer.ts`
- `tests/unit/sequence/parser.test.ts`
- `tests/unit/sequence/renderer.test.ts`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/sequencediagram/`
- `tests/corpus/sequence/*.puml` (scan for box/end box usage)

## Acceptance Criteria

- Given `"box \"System\" #LightBlue\nparticipant Alice\nend box"`,
  when parsed, then `ast.boxes` contains one entry with
  `label: "System"`, `color: "#LightBlue"`, `participantIds: ["Alice"]`
- Given a box spanning Alice and Bob, when laid out, then
  `BoxGeo.x` ≤ Alice centerX − padding and
  `BoxGeo.x + width` ≥ Bob centerX + padding
- Given a box with a label, when rendered, then a `<rect>` appears
  behind the participant headers with the label as `<text>` at top
- Given a box with no label (`box #Pink`), when rendered, then the
  `<rect>` appears with no label text
- Given a sequence diagram with no boxes, when rendered, then output
  is identical to before this change

## Quality Bar

`npm test` passes. `npm run typecheck` clean. All existing sequence
diagram tests must still pass.
