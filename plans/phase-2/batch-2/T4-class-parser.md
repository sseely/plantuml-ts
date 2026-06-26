# T4 — Class Diagram AST + Parser

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js uses a `DiagramPlugin<AST, Geo>` pattern. Each diagram type
defines its own AST and parser. The class diagram parser reads PlantUML class
diagram source and produces a typed AST.

Stack: TypeScript 5 strict, Vitest, ESM.

## Task

Create `src/diagrams/class/ast.ts` (TypeScript types) and
`src/diagrams/class/parser.ts` (regex-based line parser). Write unit tests.

## Write-Set

- `src/diagrams/class/ast.ts`
- `src/diagrams/class/parser.ts`
- `tests/unit/class/parser.test.ts`

## Read-Set

- `src/diagrams/sequence/ast.ts` — pattern to follow for AST structure
- `src/diagrams/sequence/parser.ts` — pattern to follow for parser structure
- `src/core/block-extractor.ts` — `Block` type (input to parser)
- `planning/diagram-types.md` (Class Diagrams section) — AST node shapes
  and parser notes

## Interface Contracts

```typescript
// src/diagrams/class/ast.ts

export type Visibility = '+' | '-' | '#' | '~';

export interface Member {
  visibility: Visibility;
  name: string;
  type?: string;          // return type (methods) or field type
  params?: string[];      // defined = method; undefined = attribute
  isStatic: boolean;
  isAbstract: boolean;
}

export type ClassifierKind = 'class' | 'abstract' | 'interface' | 'enum' | 'annotation';

export interface Classifier {
  id: string;             // unique identifier (alias or display name)
  display: string;
  kind: ClassifierKind;
  typeParams: string[];   // generic params e.g. ['T', 'U']
  members: Member[];
  stereotype?: string;
  color?: string;
  namespace?: string;
}

export type RelationshipType =
  | 'extension'       // <|--
  | 'implementation'  // <|..
  | 'composition'     // *--
  | 'aggregation'     // o--
  | 'dependency'      // ..>
  | 'association'     // -->
  | 'usage';          // ..

export interface Relationship {
  from: string;
  to: string;
  type: RelationshipType;
  fromMultiplicity?: string;
  toMultiplicity?: string;
  label?: string;
}

export interface Namespace {
  id: string;
  display: string;
  classifiers: string[];  // classifier ids contained in this namespace
}

export interface ClassDiagramAST {
  classifiers: Classifier[];
  relationships: Relationship[];
  namespaces: Namespace[];
}

// Parser entry point
export function parseClass(block: Block): ClassDiagramAST;
```

## Acceptance Criteria

- Given `"class Foo { +bar(): String }"`, when parsed, then AST has one
  Classifier kind="class" id="Foo" with one Member visibility="+" name="bar"
  type="String" params=[]
- Given `"interface IFoo<T, U>"`, when parsed, then kind="interface"
  typeParams=["T", "U"]
- Given `"Foo <|-- Bar"`, when parsed, then Relationship type="extension"
  from="Bar" to="Foo"
- Given `"Foo *-- Bar : 1..n"`, when parsed, then type="composition"
  toMultiplicity="1..n"
- Given `"namespace com.example { class Foo }"`, when parsed, then Namespace
  id="com.example" contains "Foo"; Classifier namespace="com.example"
- Given `"class Foo << Stereotype >>"`, when parsed, then stereotype="Stereotype"
- Given `"abstract class Base"`, when parsed, then kind="abstract"
- Given a standalone member line `"Foo : +field: int"`, when parsed, then
  member added to existing Foo classifier

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, parser tests ≥ 90%
branch coverage for the parser module.
