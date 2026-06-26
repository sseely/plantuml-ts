# Architecture Decisions

## D1 — Icon Rendering: Unicode Emoji

Render folder entries with `📂` (U+1F4C2) and file entries with `📄` (U+1F4C4)
directly in SVG `<text>` elements. Matches Java's `getEmoticon()` which returns
`<:1f4c2:>` / `<:1f4c4:>` (PlantUML creole emoji refs that resolve to these
Unicode code points in the final SVG).

Emoji rendering varies subtly per OS/browser but is universally readable.

## D2 — Canvas Width: FormulaMeasurer

`layoutSync` receives a `StringMeasurer` as its third parameter — already wired.
Use it to measure each label's pixel width:

```typescript
const { width } = measurer.measure('📂 ' + name, { family: 'sans-serif', size: 14 });
totalWidth = max(depth * 20 + labelWidth + 10) across all entries
```

`FormulaMeasurer` uses PlantUML's `StringBounderFixed.java` glyph-advance table —
more accurate than a fixed 7px/char multiplier, zero extra wiring cost.

## D3 — Note Box: Rounded Yellow Rect

Render `<note>…</note>` entries as a yellow rounded rectangle with text inside:

```
fill: '#FEFECE'   stroke: '#AAAAAA'   strokeWidth: 1   rx: 4
font: 12px sans-serif   padding: 6px
```

Matches PlantUML's "Opale" note bubble visual identity.

## D4 — Tree Construction: Java-Faithful Insertion Order

Port `FEntry.addRawEntry` exactly:
- Strip leading `/` from each path line.
- Split on the first `/`: left side = folder name, right side = remainder.
- If no `/`: create a DATA file node as a child of the current node.
- If remainder is empty (trailing slash): just ensure the folder exists; no file child.
- If remainder non-empty: recurse into folder.
- `getOrCreateFolder`: reuse existing folder with same name, else append new one.
- Insertion order = input order; never sort.

Note attachment: `lastCreated.getParent().addNote(note)`. If `lastCreated` is null,
attach to root.

## D5 — Layout Constants

```
ROW_HEIGHT   = 22    (pixels between entry baselines)
INDENT       = 20    (pixels per depth level)
PADDING      = 10    (horizontal padding on each side of canvas)
FONT_SIZE    = 14    (px, matches Java's font)
NOTE_FONT    = 12    (px for note text)
NOTE_PAD     = 6     (px padding inside note box)
```
