# T2 — Parser + Parser Tests

## Context

plantuml-js is a TypeScript port of PlantUML. Stack: vitest, tsc, eslint, vite.
Pattern reference: `src/diagrams/board/parser.ts`.

Port `FEntry.addRawEntry` and `FilesListing` from Java faithfully. The Java
source is at `~/git/plantuml/src/main/java/net/sourceforge/plantuml/filesdiagram/`.

## Task

Create `src/diagrams/files/parser.ts` and `tests/unit/files/parser.test.ts`.

## Write-Set

- `src/diagrams/files/parser.ts` (create)
- `tests/unit/files/parser.test.ts` (create)

## Read-Set

- `src/diagrams/files/ast.ts` — `FileEntry`, `FilesDiagramAST`, `FileEntryType`
- `src/core/block-extractor.ts` lines 1–35 — `UmlSource` type
- `src/diagrams/board/parser.ts` — structural pattern

## Tree Construction Algorithm (port from Java exactly)

```
root = { type: 'folder', name: '', children: [] }
lastCreated = null

for each input line:
  if line starts with '/':
    raw = line.substring(1)          // strip leading '/'
    lastCreated = addRawEntry(root, raw)
  elif line starts with '<note>':
    collect lines until '</note>'
    parent = lastCreated?.parent ?? root
    parent.children.push({ type:'note', name:'NOTE', children:[], noteLines })
  // else: ignore (@startfiles, @endfiles, blank, <style>...</style>, !theme, etc.)

function addRawEntry(node, raw):
  x = raw.indexOf('/')
  if x === -1:
    // leaf: DATA file
    child = { type:'file', name:raw, children:[] }
    node.children.push(child)
    return child
  folderName = raw.substring(0, x)
  folder = getOrCreateFolder(node, folderName)
  remain = raw.substring(x + 1)
  if remain.length === 0:
    return null        // trailing slash: folder declared, no file child
  return addRawEntry(folder, remain)

function getOrCreateFolder(node, name):
  existing = node.children.find(c => c.type==='folder' && c.name===name)
  if existing: return existing
  child = { type:'folder', name, children:[] }
  node.children.push(child)
  return child
```

**Critical edge cases:**
- `/.github/` → folder `.github` at root (trailing slash, returns null, lastCreated stays null if first line)
- `/.github` (no trailing slash) → DATA file `.github` at root (NOT a folder)
- `<style>…</style>` blocks: accumulate and skip all lines until `</style>`
- `<note>` with no prior file entry (`lastCreated === null`): note attaches to root
- After a `<note>` block, `lastCreated` is NOT updated (notes don't count as lastCreated)

## Interface Contract

```typescript
export function parseFiles(source: UmlSource): FilesDiagramAST
```

## Acceptance Criteria

- **AC1:** `/src/foo.ts` → root has folder `src`; `src` has file `foo.ts`
- **AC2:** `/src/` (trailing slash) → root has folder `src` with no file children from this line
- **AC3:** `/.github` (no trailing slash) → DATA file `.github` at root (not a folder)
- **AC4:** `/src/a.ts` then `/src/b.ts` → single shared `src` folder with two children
- **AC5:** `<note>` after `/src/foo.ts` → NOTE child of `src` folder (not root, not `foo.ts`)
- **AC6:** `<note>` as first entry (no prior file) → NOTE child of root
- **AC7:** `<style>…</style>` block silently consumed; `!theme`, blank lines, directives ignored
- **AC8:** `@startfiles` / `@endfiles` wrapper lines produce no tree entries
- **AC9:** `~` in filename (e.g. `/tests/~init.py`) treated as part of the name
- **AC10:** Full path `/a/b/c/d.ts` → nested folders `a → b → c → file d.ts`

## Quality Bar

`npm test -- --run tests/unit/files/parser.test.ts` passes.
`npm run typecheck` and `npm run lint` pass with zero new errors.
90/90/90 coverage on `parser.ts`. Write at least 12 tests.

## Commit

`feat(files): add parser and parser tests`
