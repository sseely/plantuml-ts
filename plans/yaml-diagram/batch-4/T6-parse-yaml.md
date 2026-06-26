# T6 — parseYaml() Entry Point

## Context

plantuml-js ports PlantUML's `YamlDiagramFactory`. The factory:
1. Runs the source through `StyleExtractor` (strips `<style>` blocks)
2. Skips the first line (`@startyaml`) and last line (`@endyaml`)
3. Extracts `#highlight` lines and builds `Highlighted` path objects
4. Passes remaining lines to `YamlParser`
5. Converts the result to `JsonValue` via `MonomorphToJson`
6. Returns a `JsonDiagram` (in Java) / `JsonDiagramAST` (in TypeScript)

The TypeScript `parseYaml()` function produces a `JsonDiagramAST` — the
exact same type as `parseJson()` from the JSON diagram.

Java references:
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/yaml/YamlDiagramFactory.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/yaml/Highlighted.java`

## Task

Replace the stub in `src/diagrams/yaml/parser.ts` with the full implementation.

### parseYaml(source: UmlSource): JsonDiagramAST

```typescript
export function parseYaml(source: UmlSource): JsonDiagramAST {
  const highlights: (readonly string[])[] = [];
  const bodyLines: string[] = [];
  let title: string | undefined;
  let inStyleBlock = false;

  for (const line of source.lines) {
    const t = line.trim();

    // Skip @startyaml and @endyaml wrapper lines
    if (/^@startyaml\s*$/i.test(t) || /^@endyaml\s*$/i.test(t)) continue;

    // <style> blocks stripped before YAML parsing
    if (t === '<style>') { inStyleBlock = true; continue; }
    if (inStyleBlock) { if (t === '</style>') inStyleBlock = false; continue; }

    // #highlight lines — extract before YAML
    if (t.startsWith('#highlight ')) {
      highlights.push(parseYamlHighlightLine(t));
      continue;
    }

    // Directive lines before YAML body
    if (bodyLines.length === 0) {
      if (/^title\s+/i.test(t)) {
        title = t.replace(/^title\s+/i, '').trim();
        continue;
      }
      if (/^(?:skinparam|scale|skin|hide|!assume|!pragma)\s/i.test(t)) continue;
    }

    if (t === '') {
      if (bodyLines.length > 0) bodyLines.push(line);
      continue;
    }

    bodyLines.push(line);
  }

  let root: unknown = null;
  try {
    if (bodyLines.some(l => l.trim() !== '')) {
      const monomorph = parseYamlLines(bodyLines);  // from yaml-parser.ts
      root = monomorphToJson(monomorph);             // from monomorph.ts
    }
  } catch (e) {
    // on parse error, root stays null
  }

  return title !== undefined
    ? { root, parseError: false, highlights, title }
    : { root, parseError: false, highlights };
}
```

### parseYamlHighlightLine(line: string): readonly string[]

Port `Highlighted.build()` and `Highlighted.toList()` from Java.

Input: the full `#highlight ...` line.

Algorithm:
1. Strip `#highlight ` prefix
2. Strip trailing `<<stereotype>>` (regex: `\s*<<[^<>]*>>\s*$`)
3. Split by `/` (trim each segment, strip surrounding `"` from each segment)

Examples:
- `#highlight "fruit"` → `['fruit']`
- `#highlight "xmas-fifth-day" / "partridges"` → `['xmas-fifth-day', 'partridges']`
- `#highlight xmas-fifth-day/partridges` → `['xmas-fifth-day', 'partridges']`
- `#highlight * /french-hens` → `['*', 'french-hens']`
- `#highlight ** /location` → `['**', 'location']`
- `#highlight "fruit" <<h1>>` → `['fruit']` (stereotype stripped)

### Update T1's stub in src/diagrams/yaml/index.ts

T1 imported `parseYaml` from parser.ts. Now the real implementation is in
place; the import should work unchanged (the stub was a placeholder only).

## Write-set

- `src/diagrams/yaml/parser.ts` (replace stub with full implementation)
- `tests/unit/yaml/parser.test.ts` (create — smoke tests)

## Read-set

- Java sources above
- `src/diagrams/yaml/yaml-parser.ts` (T5 — parseYamlLines)
- `src/diagrams/yaml/monomorph.ts` (T3 — monomorphToJson)
- `src/diagrams/json/ast.ts` — JsonDiagramAST interface
- `src/diagrams/yaml/index.ts` (T1 — verify import still valid)
- `tests/unit/json/parser.test.ts` — JSON parser test patterns to mirror

## Acceptance criteria

- `source.lines = ['fruit: Apple', 'size: Large']`, `source.type = 'yaml'`
  → `ast.root === {fruit: 'Apple', size: 'Large'}`
- `ast.parseError === false` always (YAML errors set `root = null`, not
  `parseError = true` — YAML doesn't have a separate parse-error flag)
- `['#highlight "fruit"', 'fruit: Apple']` → `highlights === [['fruit']]`
- `['#highlight xmas-fifth-day/partridges', 'foo: bar']` →
  `highlights === [['xmas-fifth-day', 'partridges']]`
- `['#highlight * /french-hens', 'foo: bar']` →
  `highlights === [['*', 'french-hens']]`
- `['title My Title', 'foo: bar']` → `ast.title === 'My Title'`
- `['skinparam handwritten true', 'foo: bar']` →
  `ast.root === {foo: 'bar'}` (skinparam stripped, not in body)
- `['<style>', 'yamlDiagram { node { BackGroundColor red } }', '</style>', 'foo: bar']` →
  `ast.root === {foo: 'bar'}` (style block stripped from body)
- `source.lines = []` → `ast.root === null`, no error

## Quality bar

`npm test && npm run typecheck && npm run lint && npm run build` must pass.
After T6, `renderSync('@startyaml\nfruit: Apple\nsize: Large\n@endyaml')`
should return a non-empty SVG string.
