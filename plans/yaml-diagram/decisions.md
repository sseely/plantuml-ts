# Architecture Decisions

## D1: No external YAML parser — port Java YamlParser directly

**Decision:** Port `YamlParser`, `YamlBuilder`, `Monomorph`, `MonomorphToJson`,
and `YamlLine` from Java. Do not use `js-yaml`, `yaml`, or `fast-yaml`.

**Evaluation of alternatives:**

| Edge case | js-yaml | yaml (npm) | fast-yaml | Java custom |
|-----------|---------|------------|-----------|-------------|
| Tab indentation | Error | Error | Error | Expands to 4 spaces |
| `key:value` (no space) | Parses differently | Parses differently | Varies | Old path adds space |
| Comment within multiline block | Not skipped | Not skipped | Not skipped | Skipped as EMPTY_LINE |
| Block scalar `\|` partial (just trim) | Full spec | Full spec | Full spec | Stub — just trim |
| PlantUML KEY_ONLY+text-continuation | Not supported | Not supported | Not supported | Specific behavior |

**Why:** PlantUML's YAML is a restricted dialect with specific quirks — tabs
as indentation, comment-skipping within multiline blocks, the KEY_ONLY +
NO_KEY_ONLY_TEXT continuation pattern. Any external parser would: (a) reject
valid PlantUML YAML inputs, (b) produce different results for multiline-text
continuation, (c) require extensive post-processing. The port is ~300 lines of
TypeScript and produces exact Java-compatible output.

---

## D2: Wildcard highlights — extend buildHighlightMap in json/layout.ts

**Decision:** Extend `buildHighlightMap` in `src/diagrams/json/layout.ts` to
handle `*` (match any key at one level) and `**` (recursive match at any depth).

**Why:** YAML highlight paths can contain wildcards (`*`, `**`). The JSON layout
already has `buildHighlightMap`; extending it is backward compatible (existing
JSON tests verify no regression). Expanding wildcards at parse time is
chicken-and-egg (we need the parsed tree to know what `*` expands to).

**How `*` works:** When walking a path segment that is `"*"`, instead of doing
a single child lookup, find ALL children of the current node and mark the next
segment (or final key) as highlighted in each.

**How `**` works:** When a segment is `"**"`, the next segment is the key to
match. Search the current node AND all descendants for nodes that have a child
with that key name, and mark it.

---

## D3: yamlDiagram style selectors — alias in src/index.ts

**Decision:** In `src/index.ts`'s `resolveThemeWithStyles`, add handling for
`yamldiagram.node`, `yamldiagram.arrow`, `yamldiagram.node.separator`, and
`yamldiagram.node.highlight` that mirrors the existing `jsondiagram.*` logic.

**Why:** `<style>` blocks in YAML use `yamlDiagram { node { ... } }`. The
existing JSON renderer reads `jsondiagram.node` from the theme. Adding explicit
handling for `yamldiagram.*` in `src/index.ts` is clean, one place, and keeps
the YAML plugin self-contained (no style-map remapping inside the plugin).

**Also handle:** `element` and `document` selectors inside `yamlDiagram { ... }`
(seen in `gipoxa-19-bico146` fixture). These alias to `jsondiagram.node` and
are silently accepted if not mapped.

---

## D4: Active Java parser path

**Decision:** Port `YamlParser` + `YamlBuilder` + `Monomorph` + `MonomorphToJson`.
Do NOT port `SimpleYamlParser` or `YamlLines` (those are the old commented-out path).

**Evidence:** `YamlDiagramFactory.java` line:
```java
// yaml = new SimpleYamlParser().parse(list);  // commented out
yaml = MonomorphToJson.convert(new YamlParser().parse(list));  // active
```

---

## D5: KEY_AND_FOLDED_STYLE (>) is unimplemented

**Decision:** `YamlLineType.KEY_AND_FOLDED_STYLE` is detected but
`YamlParser.parse()` throws `UnsupportedOperationException` ("wip4"). Mirror
this: when a folded-style line is encountered, return an empty string value
(do not throw — just degrade gracefully). Document as known limitation.

---

## D6: cleanBlockStyle is a stub

**Decision:** `YamlParser.cleanBlockStyle()` in Java just does `s.trim()`
with a comment "Not finished!". Mirror this exactly — block scalar lines are
trimmed but not further processed.
