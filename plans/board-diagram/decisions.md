# Architecture Decisions

## A — BoardGeometry shape

**Decision:** Use explicit `ActivityGeometry[]` with precomputed pixel-position
`CardGeometry[]` returned from `layoutSync`. Do not fold layout into render.

**Why:** Enables unit-testing of coordinate computation without parsing SVG
output. Matches the plugin contract (`layoutSync` → typed geometry → `render`).

**How to apply:** `layout.ts` exports `BoardGeometry` and `layoutBoard(ast)`
function. `renderer.ts` consumes `BoardGeometry` to build SVG strings.

---

## B — CardBox drop shadow

**Decision:** Draw an offset `<rect>` at (cardX+1, cardY+1) in `#AAAAAA`
behind each card. No SVG `<filter>`.

**Why:** Java uses `rect.setDeltaShadow(1)` — a 1px shadow. A simple offset
rect is a faithful approximation with no filter complexity. Keeps the renderer
a pure string-building function with no `<defs>` additions.

**How to apply:** In `renderer.ts`, for each card at `(cx, cy)` (card origin
including the 10px inset), emit:
  1. `<rect x=cx+1 y=cy+1 width=150 height=70 fill="#AAAAAA"/>` (shadow)
  2. `<rect x=cx y=cy width=150 height=70 fill="#D3D3D3" stroke="#000000"/>` (card)
  3. `<text x=cx+3 y=cy+3 dominant-baseline="hanging" ...>label</text>`

---

## C — Text vertical positioning inside CardBox

**Decision:** Use `dominant-baseline="hanging"` with `x=cardX+3, y=cardY+3`.

**Why:** Java draws text via `UTranslate(3, 3)` — PlantUML's text block
handles ascent internally. `dominant-baseline="hanging"` makes SVG `y`
the top-of-glyph, reproducing (3,3) inset cleanly without a magic constant.

**How to apply:** In `renderer.ts`, emit text element with these two attributes
set on the `<text>` tag.

---

## D — computeX Java fidelity

The DFS runs pre-order. The root claims `count.intValue()` before recursing.
For children at index `i > 0`, `count.addAndGet(1)` runs **before** recursing
into that child. Index 0 gets no pre-increment.

Result: a node and its first child always share the same x coordinate.
Second child increments x by 1, third by 1 more, etc.

**Verified trace** (fixture `gasaxu-65-cipo396`):
```
World(0)  x=0
  Europe(1)  x=0  (i=0, no inc)
    France(2)  x=0  (i=0, no inc)
      Paris(3)   x=0  (i=0, no inc)
      Brest(3)   x=1  (i=1, inc → count=1)
    Espagne(2) x=2  (i=1, inc → count=2)
      Madrid(3)    x=2  (i=0)
      Barcelone(3) x=3  (i=1, inc → count=3)
      Pamplune(3)  x=4  (i=2, inc → count=4)
  America(1) x=5  (i=1, inc → count=5)
    Montreal(3) x=5  (i=0)
```
→ maxX=5, maxY=3, fullWidth=(5+1)×170=1020

---

## E — Double-draw of column header (Java fidelity)

Java's `Activity.drawMe` calls `getBox().drawU(ug)` first (draws the header
`CardBox` at position (0,0) within the activity), then iterates `BArray` which
also includes the root `BNode` (stage=0, x=0). The root is therefore drawn
twice at the same position.

**Decision:** Mirror this behavior. In `renderer.ts`, for each activity:
1. Draw the header card at `(activityOffset, 0)` — 10px inset → `(activityOffset+10, 10)`
2. Loop BArray nodes (including root at stage=0, x=0) and draw each card

The visual result is that the header card appears at full opacity (two rects
layered, no visible difference).

---

## F — Scope exclusions

The following **do not appear in the Java source** and must not be implemented:
- Card colors via `[#color]` syntax
- `| column | header` syntax
- `card` keyword
