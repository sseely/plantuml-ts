# T1 — Annotation model + command regexes

## Context

plantuml-ts (TypeScript port of PlantUML; vitest, tests under `tests/unit/`,
strict tsc, eslint). Upstream is the spec: `~/git/plantuml/src/main/java/`
(grep the whole `net/` tree). We are porting the diagram-annotation model and
the commands that populate it. Port faithfully — preserve upstream names and
quirks; no cleanups (project CLAUDE.md "Do not refactor while porting").
Browser-safe: no Node built-ins, no Date.now/Math.random.

## Task

Create `src/core/annotations/` with:

1. **`model.ts`** — port `DisplayPositioned`
   (`net/sourceforge/plantuml/abel/DisplayPositioned.java:48-116`): immutable
   `{ display, horizontalAlignment, verticalAlignment, location }` with
   `with*` copies, `single(...)`, `none(halign, valign)` (display = null
   Display), `isNull()`. `Display` here = `string[]` of raw display lines
   (creole parsed later, at draw time). Port `HorizontalAlignment.fromString
   (s, default)` and `VerticalAlignment.fromString` (`top`→TOP, everything
   else incl. null → BOTTOM — center is commented out upstream) if klimt's
   `src/core/klimt/geom/` versions lack the fromString semantics (check
   first; extend there if they exist — klimt owns those enums).
   Define `DiagramAnnotations` mirroring `TitledDiagram`'s fields
   (`TitledDiagram.java:89-95`): title (none CENTER/TOP), caption (none
   CENTER/BOTTOM), legend (none CENTER/BOTTOM), header (none CENTER/null),
   footer (none CENTER/null), mainFrame (none null/null). Port the mutator
   semantics: `setTitle` rejects null/white display (`:168-172`);
   header/footer use incremental `updateHeader/updateFooter`
   (`:210-218`) that preserve-and-swap.
   Also: `isEmpty(annotations)` helper (all six isNull) so integration can
   skip chrome entirely (byte-stability, decisions.md D5).

2. **`commands.ts`** — a line-oriented matcher the parsers will call:
   `matchAnnotationCommand(lines, i, annotations) → { consumed: number } |
   null`. It must handle single-line AND multiline forms, consuming
   multiline bodies through their end markers. Port each regex faithfully
   from `net/sourceforge/plantuml/command/` (translate `[%s]`→`[ \t ]`-
   class as the codebase already does for other ports — check how existing
   parsers translate `[%s]`/`[%g]`/`[%pLN]`; grep `%pLN` in src/ first):
   - CommandTitle (`CommandTitle.java:51-61`): `title` + `(?:[%s]*:[%s]*|[%s]+)` + quoted-or-unquoted value (`[%g](.*)[%g]` | `(.*[%pLN_.].*)`) → setTitle(single(v, CENTER, TOP))
   - CommandMultilinesTitle: `^title$` … `^end[%s]?title$`
   - CommandCaption / CommandMultilinesCaption (same shapes, CENTER/BOTTOM)
   - CommandLegend: `legend` + sep + value → single(v, CENTER, BOTTOM), no options
   - CommandMultilinesLegend: `legend( (top|bottom))?( (left|right|center))?`
     … `^end[%s]?legend$`; VALIGN before ALIGN; halign null→CENTER
   - CommandHeader/Footer: optional `(left|right|center)` PREFIX + `header|footer`
     + `:`-or-space + value → updateHeader/updateFooter; alignment from
     prefix else null (style default applied at draw time: header RIGHT,
     footer CENTER — decisions.md D8)
   - CommandMultilinesHeader/Footer: `^(?:(left|right|center)?[%s]*)header$`
     … `^end[%s]?header$` (same for footer)
   - CommandMainframe (find it: `net/sourceforge/plantuml/command/CommandMainframe.java`) — parse into mainFrame; rendering is T9.
   Multiline bodies: keep raw lines; apply upstream's `replaceBackslashT`
   (tab escape) equivalent.

3. **`index.ts`** — public re-exports.

Do NOT touch any parser or renderer — wiring is T5/T6.

## Read-set

- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/abel/DisplayPositioned.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/TitledDiagram.java:81-232`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/command/Command{Title,MultilinesTitle,Caption,MultilinesCaption,Legend,MultilinesLegend,Header,MultilinesHeader,Footer,MultilinesFooter,Mainframe}.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/command/CommonCommands.java:54-124` (registration order — your matcher must try commands in an order that reproduces it)
- `src/core/klimt/geom/HorizontalAlignment.ts`, `VerticalAlignment.ts` (extend, don't duplicate)
- One existing regex-port for the `[%s]`/`[%g]`/`[%pLN]` translation idiom (grep `pLN\|%g` under src/)

## Interface contract (consumed by T4/T5/T6/T7)

```ts
export interface DisplayPositioned { display: readonly string[] | null; horizontalAlignment: HorizontalAlignment | null; verticalAlignment: VerticalAlignment | null; }
export interface DiagramAnnotations { title; caption; legend; header; footer; mainFrame: DisplayPositioned; }
export function createAnnotations(): DiagramAnnotations;           // all none() defaults
export function isEmpty(a: DiagramAnnotations): boolean;
export function matchAnnotationCommand(lines: readonly string[], i: number, a: DiagramAnnotations): { consumed: number } | null;
```

(Exact shapes may grow fields — record deviations in the decision journal.)

## Acceptance criteria

- Given `title Hello World`, when matched, then annotations.title has display `["Hello World"]`, CENTER/TOP, consumed 1.
- Given `title "quoted"` and `title : colon form`, both match (quoted strips quotes).
- Given `title` alone then lines then `end title`, multiline consumes through the end marker inclusive; `endtitle` (no space) also closes.
- Given `legend top right` … `end legend`, legend has TOP/RIGHT; bare `legend`+body defaults CENTER/BOTTOM; `legend: one-liner` single-line works.
- Given `left header foo` / `center footer bar`, alignment stored LEFT/CENTER; bare `header x2` leaves alignment null.
- Given a non-annotation line (`titleize this`, `header:` with empty value per regex), matcher returns null and consumes nothing.
- Unit tests cover every command incl. mainframe, quoted/unquoted/colon variants, and the `%pLN` unquoted-value constraint (a value must contain a letter/number/_/.).

## Quality bar

`npm test`, `npm run typecheck`, `npm run lint` green. Coverage of the new
module ≥90/90/90. Every ported symbol carries `@see` JSDoc to its Java origin.

## Observability: N/A — no new observable operations.
## Rollback: Reversible (git revert; module unused until batch 2+).
## Commit: `feat(T1): port DisplayPositioned model + annotation command regexes`
