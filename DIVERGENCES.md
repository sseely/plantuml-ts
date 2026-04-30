# Intentional Divergences from Upstream PlantUML

Upstream behavior is preserved by default. Entries here are deliberate
exceptions — places where this port produces different output for a
documented reason. Each entry records what changed, why, and the category
of divergence so reviewers can judge whether to adopt, revert, or escalate.

Categories:
- **clarity** — same information, presented more clearly
- **aesthetic** — visual improvement with no semantic change
- **limitation** — upstream has a known gap; we fill it

---

## JSON diagrams

### Array index keys (clarity)

**Upstream:** array elements have no key label in the key column — the
left column is blank for every array entry.

**This port:** array elements show their zero-based index (`0`, `1`, `2`,
…) in the key column.

**Reason:** a blank key column makes nested array diagrams unreadable.
Without index labels you cannot tell which child node corresponds to which
array position. Showing the index is strictly more informative and imposes
no cost on the value column. The upstream behavior is most likely a gap
rather than a deliberate design choice.

**Affects:** all `@startjson` diagrams whose root or any nested value is an
array.

---

### Primitive root — empty key cell (clarity)

**Upstream:** a scalar root value (number, string, boolean, null) is
rendered differently from object/array roots; the key column behavior is
not well-defined.

**This port:** scalar roots are wrapped in a synthetic single-row node
with an empty key (`""`) and the scalar as the value. The two-column
layout is preserved and the key cell is simply blank.

**Reason:** keeping a uniform two-column layout avoids special-casing
both the layout engine and the renderer for a rare edge case. The empty
key cell is visually harmless and maintains consistency with object nodes.

**Affects:** `@startjson` diagrams whose root value is a primitive scalar.
