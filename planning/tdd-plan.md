# TDD Plan

Write each test before writing its implementation. Every test in this document
starts red. When the implementation is correct the test turns green. Move to
the next test only after green.

Tests are listed bottom-up within each layer (smallest unit first) and
top-down across layers (foundational modules before the ones that depend on
them). Within a layer, write tests in the order listed.

---

## How to read this document

Each section has a **test file path**, then a sequence of tests. For each:

- **it(...)** — the exact test description to use in Vitest
- **Input** — the value to pass in
- **Assert** — what the test must verify (what fails red until implementation exists)
- **Green when** — the minimum code that makes it pass

---

## Phase 1 — Foundation + Sequence Diagrams

### `tests/unit/preprocessor.test.ts`

**it** strips single-line comments  
Input: `["' this is a comment", "Alice -> Bob: hi"]`  
Assert: output is `["Alice -> Bob: hi"]`  
Green when: lines starting with `'` are removed before returning

**it** strips mid-line trailing comments  
Input: `["Alice -> Bob: hi ' ignored"]`  
Assert: output is `["Alice -> Bob: hi"]`  
Green when: content after ` '` (space-quote) is trimmed

**it** replaces !define token in subsequent lines  
Input: `["!define TIMEOUT 30", "delay TIMEOUT"]`  
Assert: output is `["delay 30"]`  
Green when: `!define` is stored and later occurrences of the token are replaced

**it** !define with no value substitutes empty string  
Input: `["!define DEBUG", "note DEBUG over Alice"]`  
Assert: output is `["note  over Alice"]`  
Green when: valueless `!define` stores empty string

**it** !undefine removes a previous definition  
Input: `["!define FOO bar", "!undefine FOO", "text FOO"]`  
Assert: output is `["text FOO"]` (FOO left as-is, no substitution)  
Green when: `!undefine` deletes the token from the defines map

**it** !ifdef includes block when token is defined  
Input: `["!define DEBUG", "!ifdef DEBUG", "note debug", "!endif", "Alice -> Bob"]`  
Assert: output is `["note debug", "Alice -> Bob"]`  
Green when: `!ifdef`/`!endif` block is kept when token is defined

**it** !ifdef skips block when token is not defined  
Input: `["!ifdef DEBUG", "note debug", "!endif", "Alice -> Bob"]`  
Assert: output is `["Alice -> Bob"]`  
Green when: `!ifdef`/`!endif` block is removed when token is absent

**it** !ifndef includes block when token is not defined  
Input: `["!ifndef PROD", "note dev only", "!endif"]`  
Assert: output is `["note dev only"]`  
Green when: `!ifndef`/`!endif` included when token absent

**it** !ifndef skips block when token is defined  
Input: `["!define PROD", "!ifndef PROD", "note dev only", "!endif"]`  
Assert: output is `[]`  
Green when: `!ifndef`/`!endif` removed when token present

**it** nested !ifdef works correctly  
Input: `["!define A", "!define B", "!ifdef A", "!ifdef B", "both", "!endif", "!endif"]`  
Assert: output is `["both"]`  
Green when: ifdef nesting tracked with a depth counter

**it** !theme directive is stripped from output  
Input: `["!theme dark", "Alice -> Bob"]`  
Assert: output lines do not contain `!theme dark`; returned metadata has `theme: "dark"`  
Green when: `!theme` is consumed and exposed as metadata, not forwarded as a line

---

### `tests/unit/block-extractor.test.ts`

**it** extracts a single @startuml / @enduml block  
Input: `"@startuml\nAlice -> Bob\n@enduml"`  
Assert: returns array of length 1; `block.lines` equals `["Alice -> Bob"]`  
Green when: regex or state-machine finds start/end markers

**it** returns empty array when no @startuml present  
Input: `"just plain text"`  
Assert: returns `[]`  
Green when: no match → return early

**it** extracts multiple blocks from one string  
Input: two separate `@startuml…@enduml` sections  
Assert: returns array of length 2, each with correct lines  
Green when: loop continues scanning after first `@enduml`

**it** trims leading/trailing blank lines inside a block  
Input: `"@startuml\n\nAlice -> Bob\n\n@enduml"`  
Assert: `block.lines` does not start or end with empty string  
Green when: lines array is trimmed after extraction

**it** detects sequence type from @startuml with arrow on first line  
Input: block whose first content line is `Alice -> Bob`  
Assert: `block.type === 'sequence'`  
Green when: type detector checks first non-empty line for `->` / `-->` / `->>` / participant/actor keyword

**it** detects class type from @startuml  
Input: block whose first content line is `class Foo`  
Assert: `block.type === 'class'`  
Green when: type detector matches `^class ` / `^abstract class ` / `^interface ` / `^enum `

**it** detects state type from @startuml  
Input: block whose first content line is `[*] --> Idle`  
Assert: `block.type === 'state'`  
Green when: type detector matches `[*]` pattern

**it** detects diagram type from @start<type> keyword directly  
Input: `"@startmindmap\n* Root\n@endmindmap"`  
Assert: `block.type === 'mindmap'`  
Green when: parser reads `start<type>` suffix

**it** detects gantt from @startgantt  
Input: `"@startgantt\n[Task] lasts 3 days\n@endgantt"`  
Assert: `block.type === 'gantt'`  
Green when: `startgantt` suffix maps to `'gantt'`

---

### `tests/unit/creole.test.ts`

**it** renders plain text unchanged  
Input: `"hello world"`  
Assert: output is `<tspan>hello world</tspan>`  
Green when: no markup → single tspan wrapping text

**it** renders **bold** as font-weight bold tspan  
Input: `"**bold**"`  
Assert: output contains `font-weight="bold"` tspan wrapping `bold`  
Green when: `**...**` delimiters parsed and font-weight applied

**it** renders //italic//  
Input: `"//italic//"`  
Assert: output contains `font-style="italic"` tspan  
Green when: `//...//` delimiters parsed

**it** renders --strikethrough--  
Input: `"--strike--"`  
Assert: output contains `text-decoration="line-through"` tspan  
Green when: `--...--` delimiters parsed

**it** renders __underline__  
Input: `"__under__"`  
Assert: output contains `text-decoration="underline"` tspan  
Green when: `__...__` delimiters parsed

**it** renders mixed markup in one string  
Input: `"**bold** and //italic//"`  
Assert: output has two styled tspan elements and one unstyled tspan for " and "  
Green when: parser splits on markup boundaries

**it** renders color markup  
Input: `"<color:red>colored</color>"`  
Assert: output contains `fill="red"` tspan  
Green when: `<color:X>…</color>` parsed and fill attribute set

---

### `tests/unit/svg-primitives.test.ts`

**it** rect returns valid SVG rect element string  
Assert: output matches `/<rect x="0" y="0" width="100" height="50"/`  
Green when: `rect(0, 0, 100, 50, {})` returns correct string

**it** rect includes fill and stroke from style  
Assert: output contains `fill="white"` and `stroke="black"`  
Green when: BoxStyle properties map to SVG attributes

**it** line returns valid SVG line element  
Assert: output matches `/<line x1="0" y1="0" x2="100" y2="0"/`  
Green when: `line(0, 0, 100, 0, {})` returns correct string

**it** text returns SVG text element with tspan children  
Assert: output contains `<text` and `<tspan`  
Green when: `text(10, 20, "hello", {})` renders with tspan from creole

**it** path returns SVG path element  
Assert: output matches `/<path d="M 0 0 L 100 100"/`  
Green when: `path("M 0 0 L 100 100", {})` returns correct string

**it** group wraps children in SVG g element  
Assert: output is `<g id="grp">…children…</g>`  
Green when: `group("grp", ["<line/>"])` returns correct string

**it** svgRoot wraps all in svg element with correct viewBox  
Assert: starts with `<svg xmlns="http://www.w3.org/2000/svg"` and has viewBox  
Green when: `svgRoot(400, 300, [...])` returns valid SVG wrapper

**it** arrowHead returns marker element for 'sync' type  
Assert: output contains `<marker` and a filled polygon  
Green when: `arrowHead('sync')` returns `<marker>` definition

---

### `tests/unit/sequence/parser.test.ts`

**it** parses participant declaration  
Input: `["participant Alice"]`  
Assert: `ast.participants[0]` equals `{ id: "Alice", display: "Alice", type: "participant" }`  
Green when: `CommandParticipant` regex matches and adds to participants list

**it** parses actor declaration  
Input: `["actor Bob"]`  
Assert: `ast.participants[0].type === "actor"`  
Green when: `CommandActor` regex matches

**it** parses participant with alias  
Input: `["participant \"Alice Smith\" as A"]`  
Assert: `ast.participants[0]` equals `{ id: "A", display: "Alice Smith", type: "participant" }`  
Green when: alias regex captures both label and id

**it** parses participant with color  
Input: `["participant Alice #lightblue"]`  
Assert: `ast.participants[0].color === "#lightblue"`  
Green when: color regex appended to participant command

**it** auto-creates participants from message  
Input: `["Alice -> Bob: hi"]`  
Assert: `ast.participants` has two entries with ids "Alice" and "Bob"  
Green when: message command checks and inserts missing participants

**it** parses synchronous message  
Input: `["Alice -> Bob: hello"]`  
Assert: `ast.events[0]` is `{ kind: "message", from: "Alice", to: "Bob", label: "hello", style: "sync" }`  
Green when: `CommandArrow` regex `->` matches sync style

**it** parses async message ->>  
Input: `["Alice ->> Bob: go"]`  
Assert: `ast.events[0].style === "async"`  
Green when: `->>` variant in pattern maps to async

**it** parses reply message -->  
Input: `["Bob --> Alice: ok"]`  
Assert: `ast.events[0].style === "reply"`  
Green when: `-->` maps to reply

**it** parses reply async -->>  
Input: `["Bob -->> Alice: ok"]`  
Assert: `ast.events[0].style === "replyAsync"`  
Green when: `-->>` maps to replyAsync

**it** parses self-message  
Input: `["Alice -> Alice: think"]`  
Assert: `ast.events[0].from === "Alice"` and `to === "Alice"`  
Green when: from and to may be the same participant

**it** parses lost message  
Input: `["Alice ->? : send"]`  
Assert: `ast.events[0].style === "lost"`  
Green when: `->?` pattern matches and to is set to synthetic lost target

**it** parses found message  
Input: `["?-> Bob: receive"]`  
Assert: `ast.events[0].style === "found"`  
Green when: `?->` pattern matches and from is synthetic

**it** parses autonumber  
Input: `["autonumber", "Alice -> Bob: hi", "Bob --> Alice: ok"]`  
Assert: `ast.autonumber.enabled === true` and both messages have seq numbers  
Green when: autonumber command sets flag; message command increments counter when flag is set

**it** parses autonumber with start value  
Input: `["autonumber 10", "Alice -> Bob: hi"]`  
Assert: first message has sequence number 10  
Green when: autonumber command parses integer argument

**it** parses note left of  
Input: `["note left of Alice: reminder"]`  
Assert: `ast.events[0]` is `{ kind: "note", position: "left", participants: ["Alice"], text: "reminder" }`  
Green when: note command regex matches

**it** parses note over two participants  
Input: `["note over Alice, Bob: shared note"]`  
Assert: `ast.events[0].participants` equals `["Alice", "Bob"]`  
Green when: comma-separated participant list parsed in note command

**it** parses multi-line note with end note  
Input: `["note left of Alice", "line one", "line two", "end note"]`  
Assert: `ast.events[0].text` equals `"line one\nline two"`  
Green when: block note command accumulates until `end note`

**it** parses activate / deactivate  
Input: `["activate Alice", "Alice -> Bob: hi", "deactivate Alice"]`  
Assert: `ast.events[0]` is `{ kind: "activate", participantId: "Alice" }` and `ast.events[2]` is deactivate  
Green when: activate/deactivate commands produce activation events

**it** parses activation shorthand ++  
Input: `["Alice -> Bob ++: call"]`  
Assert: message event has `activates: "Bob"` flag  
Green when: `++` suffix on target name triggers implicit activate

**it** parses loop frame  
Input: `["loop 5 times", "Alice -> Bob: ping", "end"]`  
Assert: `ast.events[0]` is `{ kind: "frame", frameType: "loop", label: "5 times", children: [...] }`  
Green when: loop command pushes frame context; end command pops it

**it** parses alt / else / end  
Input: `["alt success", "Alice -> Bob: ok", "else failure", "Alice -> Bob: fail", "end"]`  
Assert: frame has `frameType: "alt"` with two branches  
Green when: else command adds a new branch to the current alt frame

**it** parses divider  
Input: `["== Section =="]`  
Assert: `ast.events[0]` is `{ kind: "divider", text: "Section" }`  
Green when: `== ... ==` pattern matched as divider command

**it** parses delay ...  
Input: `["..."]`  
Assert: `ast.events[0]` is `{ kind: "delay" }`  
Green when: `...` pattern matched

**it** parses delay with text  
Input: `["...5 minutes later..."]`  
Assert: `ast.events[0]` is `{ kind: "delay", text: "5 minutes later" }`  
Green when: delay text is captured between `...` delimiters

**it** parses space |||  
Input: `["|||"]`  
Assert: `ast.events[0]` is `{ kind: "space", pixels: 5 }` (default)  
Green when: `|||` pattern matched

**it** parses space with pixel value  
Input: `["||25||"]`  
Assert: `ast.events[0].pixels === 25`  
Green when: `||N||` pattern captures integer

**it** parses hide footbox  
Input: `["hide footbox"]`  
Assert: `ast.options.hideFootbox === true`  
Green when: hide footbox command sets option on diagram

**it** parses skinparam sequenceMessageAlign  
Input: `["skinparam sequenceMessageAlign center"]`  
Assert: `ast.options.messageAlign === "center"`  
Green when: skinparam command dispatches to option setter

**it** parses return  
Input: `["Alice -> Bob: call", "return result"]`  
Assert: second event is `{ kind: "message", style: "reply", label: "result", from: "Bob", to: "Alice" }`  
Green when: return command generates reply to most recent message's sender

---

### `tests/unit/sequence/layout.test.ts`

**it** single participant has positive x position  
Input: `ast` with one participant  
Assert: `geo.participants[0].x > 0`  
Green when: layout assigns x based on index and default column width

**it** two participants have different x positions  
Input: `ast` with participants Alice and Bob  
Assert: `geo.participants[0].x !== geo.participants[1].x`  
Green when: each participant gets its own column

**it** three participants have strictly increasing x  
Input: participants A, B, C  
Assert: `geo.participants[0].x < geo.participants[1].x < geo.participants[2].x`  
Green when: column index assignment is monotonically increasing

**it** participant column width is at least as wide as the label  
Input: participant named "Very Long Name"  
Assert: `geo.participants[0].width >= measurer.measure("Very Long Name", defaultFont).width + padding`  
Green when: column width = max(minWidth, labelWidth + horizontalPadding)

**it** first message y is below participant box  
Input: one sync message  
Assert: `geo.events[0].y > geo.participants[0].y + geo.participants[0].height`  
Green when: messages are stacked below the participant header area

**it** second message y is below first message y  
Input: two sync messages  
Assert: `geo.events[1].y > geo.events[0].y`  
Green when: each message increments the running y offset

**it** self-message x1 and x2 differ (arrow extends right then back)  
Input: self-message on Alice  
Assert: `geo.events[0].x2 > geo.events[0].x1`  
Green when: self-message gets fixed horizontal offset to the right

**it** note left of is positioned left of participant center  
Input: note left of Alice  
Assert: `geo.events[0].x + geo.events[0].width <= geo.participants[0].x`  
Green when: note box x = participantCenterX - notePadding - noteWidth

**it** note over two participants spans both centers  
Input: note over Alice and Bob  
Assert: note x <= Alice center and note x + note width >= Bob center  
Green when: note width covers the range between both participant columns

**it** activation box has non-zero height  
Input: activate Alice / message / deactivate Alice  
Assert: activation geo height > 0  
Green when: deactivate records end-y and height = endY - startY

**it** loop frame y encompasses all contained messages  
Input: loop frame containing two messages  
Assert: frame y <= first message y and frame y + frame height >= second message y  
Green when: frame geometry is computed from min/max y of its children

---

### `tests/unit/sequence/renderer.test.ts`

**it** output starts with svg element  
Assert: output starts with `<svg`  
Green when: svgRoot is called with computed dimensions

**it** output ends with /svg  
Assert: output ends with `</svg>`  
Green when: svgRoot closes the element

**it** output contains a rect for each participant  
Input: two participants  
Assert: SVG contains at least 2 `<rect` elements (participant boxes)  
Green when: renderer iterates participants and emits boxes

**it** participant label is present in output  
Input: participant named "Alice"  
Assert: SVG contains the text "Alice"  
Green when: text element emitted for participant display name

**it** message arrow is present  
Input: one sync message  
Assert: SVG contains `<line` or `<path`  
Green when: renderer emits line/path for message arrow

**it** message label is present in output  
Input: message with label "hello"  
Assert: SVG contains text "hello"  
Green when: text element emitted for message label

**it** arrowhead marker is defined in defs  
Assert: SVG contains `<defs>` with at least one `<marker>`  
Green when: svgRoot includes arrowhead defs for all used arrow types

**it** lifeline is rendered as dashed vertical line  
Input: participant with messages  
Assert: SVG contains a line with `stroke-dasharray` on the lifeline path  
Green when: renderer emits lifeline between participant bottom and diagram bottom

**it** activation box is a filled rect on the lifeline  
Input: activate / message / deactivate  
Assert: SVG contains a filled rect overlapping the lifeline  
Green when: renderer emits rect at activation geometry position

**it** note box contains a rect and the note text  
Input: note with text "reminder"  
Assert: SVG contains `<rect` (note outline) and "reminder" in a text element  
Green when: note rendered as rect + text

**it** loop frame has a rect outline and "loop" label  
Input: loop frame with label "3 times"  
Assert: SVG contains rect for frame border and text "loop"  
Green when: frame renderer emits rect + label tspan

**it** divider renders as a full-width horizontal line with text  
Input: divider with text "Section"  
Assert: SVG contains a line spanning diagram width and text "Section"  
Green when: divider renderer emits horizontal line + centered text

**it** dark theme uses different background color than default  
Input: same source, two different themes  
Assert: participant rect fill values differ between renders  
Green when: theme.colors.background is read from the active Theme object

---

### `tests/integration/sequence.test.ts`

**it** renders minimal diagram without throwing  
Input: `"@startuml\nAlice -> Bob: Hello World\n@enduml"`  
Assert: `await render(source)` resolves to a string starting with `<svg`  
Green when: full pipeline (preprocessor → extractor → parser → layout → renderer) is wired

**it** renders all fixture files without throwing  
Input: every `.puml` file in `tests/fixtures/sequence/`  
Assert: each call to `render()` resolves; no rejections  
Green when: parser + renderer handle all syntax seen in the fixtures

**it** render() with invalid source returns error SVG, does not throw  
Input: `"@startuml\nbadline!!!\n@enduml"`  
Assert: result is an SVG containing text with "syntax error" or similar  
Green when: unknown commands are gracefully ignored or produce an error diagram

**it** renderAll() returns array with one element per block  
Input: source with two `@startuml…@enduml` blocks  
Assert: result array has length 2  
Green when: renderAll iterates blocks and renders each

---

## Phase 2 — Graph Diagrams (Class, Component, State, Use Case)

### `tests/unit/dot/layout.test.ts`

**it** converts two-node graph to DotInputGraph format  
Input: `{ nodes: [{ id: "A", width: 100, height: 50 }, { id: "B", width: 100, height: 50 }], edges: [{ id: "e1", source: "A", target: "B" }] }`  
Assert: returned `DotInputGraph` has `nodes` array of length 2 and `edges` array of length 1  
Green when: adapter maps nodes → `DotInputGraph.nodes`, edges → `DotInputGraph.edges`

**it** returned geometry has x/y for each node  
Input: same two-node graph  
Assert: after layout, each node in `DotLayoutResult` has numeric x, y, width, height  
Green when: dot engine computes and returns node positions

**it** edge in geometry has a non-empty route (array of points)  
Assert: `result.edges[0].points.length >= 2` (route exists, at minimum start+end)  
Green when: edge routing produces at least the two endpoint coordinates

**it** nodes do not overlap after layout  
Input: four nodes with edges forming a chain  
Assert: for every pair of nodes, bounding boxes do not intersect  
Green when: Sugiyama layered algorithm separates nodes with padding

---

### `tests/unit/class/parser.test.ts`

**it** parses bare class declaration  
Input: `["class Foo"]`  
Assert: `ast.classifiers[0]` equals `{ id: "Foo", display: "Foo", kind: "class", members: [] }`  
Green when: `class NAME` regex matches and adds to classifiers

**it** parses abstract class  
Input: `["abstract class Bar"]`  
Assert: `ast.classifiers[0].kind === "abstract"`  
Green when: `abstract class` prefix matched in regex

**it** parses interface  
Input: `["interface Baz"]`  
Assert: `ast.classifiers[0].kind === "interface"`  
Green when: `interface` keyword matched

**it** parses enum with values  
Input: `["enum Color {", "  RED", "  GREEN", "  BLUE", "}"]`  
Assert: classifier has kind "enum" and members RED, GREEN, BLUE  
Green when: block body parsed as member lines for enum kind

**it** parses generic type parameter  
Input: `["class Foo<T>"]`  
Assert: `ast.classifiers[0].typeParams === ["T"]`  
Green when: `<T>` suffix parsed from class name

**it** parses attribute with visibility and type  
Input: `["class Foo {", "  +name : String", "}"]`  
Assert: `members[0]` equals `{ visibility: "+", name: "name", type: "String", isMethod: false }`  
Green when: member line `VISIBILITY NAME : TYPE` parsed inside class body

**it** parses method with return type  
Input: `["class Foo {", "  +getName() : String", "}"]`  
Assert: `members[0].isMethod === true` and `members[0].type === "String"`  
Green when: `()` in member line marks it as a method

**it** parses method with parameters  
Input: `["class Foo {", "  +add(a:int, b:int):int", "}"]`  
Assert: `members[0].params` equals `["a:int", "b:int"]`  
Green when: parameter list between `()` captured

**it** parses {static} modifier  
Input: `["class Foo {", "  {static} name : String", "}"]`  
Assert: `members[0].isStatic === true`  
Green when: `{static}` prefix on member line sets flag

**it** parses {abstract} modifier  
Input: `["class Foo {", "  {abstract} void foo()", "}"]`  
Assert: `members[0].isAbstract === true`  
Green when: `{abstract}` prefix sets flag

**it** parses standalone member syntax ClassName : member  
Input: `["class Foo", "Foo : +name : String"]`  
Assert: `ast.classifiers[0].members[0].name === "name"`  
Green when: `NAME : MEMBER` line (outside block) appended to named classifier

**it** parses extension relationship  
Input: `["Foo --|> Bar"]`  
Assert: `ast.relationships[0]` equals `{ from: "Foo", to: "Bar", type: "extension" }`  
Green when: `--|>` pattern matches extension

**it** parses implementation  
Input: `["Foo ..|> Bar"]`  
Assert: `type === "implementation"`  
Green when: `..|>` maps to implementation

**it** parses composition with multiplicity  
Input: `["Foo \"1\" *-- \"n\" Bar"]`  
Assert: `{ type: "composition", fromMultiplicity: "1", toMultiplicity: "n" }`  
Green when: quoted multiplicity captured on both sides of arrow

**it** parses aggregation  
Input: `["Foo o-- Bar"]`  
Assert: `type === "aggregation"`  
Green when: `o--` maps to aggregation

**it** parses association with label  
Input: `["Foo -- Bar : uses"]`  
Assert: `{ type: "association", label: "uses" }`  
Green when: `: LABEL` suffix captured from relationship line

**it** parses namespace block  
Input: `["namespace com.example {", "  class Foo", "}"]`  
Assert: `ast.classifiers[0].namespace === "com.example"`  
Green when: namespace command sets active namespace; members created inside inherit it

**it** parses note on class  
Input: `["class Foo", "note left of Foo: a note"]`  
Assert: `ast.notes[0]` is `{ target: "Foo", position: "left", text: "a note" }`  
Green when: note command in class diagram context adds to notes list

---

### `tests/unit/class/renderer.test.ts`

**it** classifier box has three rect sections (name / attrs / methods)  
Input: class with one attribute and one method  
Assert: SVG contains 3 rect elements for the classifier  
Green when: renderer emits name box + attribute box + method box stacked vertically

**it** interface shows <<interface>> stereotype above name  
Input: interface Foo  
Assert: SVG text contains "«interface»" above "Foo"  
Green when: classifier renderer checks `kind === "interface"` and prepends stereotype text

**it** extension arrow has hollow triangle arrowhead  
Input: `Foo --|> Bar`  
Assert: SVG marker for extension uses a non-filled polygon  
Green when: `arrowHead('extension')` returns hollow triangle marker

**it** composition link has filled diamond at source end  
Input: `Foo *-- Bar`  
Assert: SVG contains a filled diamond marker  
Green when: `arrowHead('composition')` returns filled diamond marker

**it** aggregation link has hollow diamond  
Input: `Foo o-- Bar`  
Assert: SVG contains hollow (unfilled) diamond marker  
Green when: `arrowHead('aggregation')` returns hollow diamond marker

**it** multiplicity labels are placed near the arrowhead ends  
Input: `Foo "1" *-- "n" Bar`  
Assert: SVG contains text "1" near Foo end and "n" near Bar end  
Green when: relationship renderer emits text elements at edge endpoints

---

### `tests/unit/state/parser.test.ts`

**it** parses initial transition  
Input: `["[*] --> Idle"]`  
Assert: `ast.transitions[0]` equals `{ from: "__initial__", to: "Idle" }`  
Green when: `[*]` on left matched as initial pseudostate

**it** parses final transition  
Input: `["Active --> [*]"]`  
Assert: `ast.transitions[0].to === "__final__"`  
Green when: `[*]` on right matched as final pseudostate

**it** parses transition with trigger  
Input: `["Idle --> Active : start"]`  
Assert: `ast.transitions[0].label === "start"`  
Green when: `: LABEL` suffix captured

**it** parses transition with guard and action  
Input: `["Idle --> Active : event [guard] / action"]`  
Assert: `{ label: "event", guard: "guard", action: "action" }`  
Green when: guard in `[]` and action after `/` are captured from label

**it** parses state with alias  
Input: `["state \"Running State\" as RS"]`  
Assert: `ast.states["RS"].display === "Running State"`  
Green when: alias form of state declaration parsed

**it** parses composite state block  
Input: `["state Outer {", "  A --> B", "}"]`  
Assert: `ast.states["Outer"].children` contains transition A → B  
Green when: state block pushes/pops a scope; nested transitions go into parent's children

**it** parses concurrent region separator --  
Input: `["state Outer {", "  A --> B", "  --", "  C --> D", "}"]`  
Assert: `ast.states["Outer"].regions` has length 2  
Green when: `--` inside state block starts a new concurrent region

---

### `tests/unit/component/parser.test.ts`

**it** parses [Component] shorthand  
Input: `["[Database]"]`  
Assert: `ast.nodes[0]` equals `{ id: "Database", display: "Database", kind: "component" }`  
Green when: `[NAME]` regex matches and creates component node

**it** parses () interface shorthand  
Input: `["() Auth"]`  
Assert: `ast.nodes[0].kind === "interface"`  
Green when: `()` prefix matched

**it** parses package container  
Input: `["package Backend {", "  [ServiceA]", "}"]`  
Assert: `ast.nodes` contains a package node whose children include ServiceA  
Green when: package command pushes a container scope

**it** parses component relationship  
Input: `["[A] --> [B]"]`  
Assert: `ast.edges[0]` equals `{ from: "A", to: "B", style: "solid" }`  
Green when: relationship pattern matches `[A] --> [B]`

**it** parses dashed relationship  
Input: `["[A] ..> [B]"]`  
Assert: `ast.edges[0].style === "dashed"`  
Green when: `..>` matched as dashed style

---

### `tests/unit/usecase/parser.test.ts`

**it** parses actor declaration  
Input: `["actor User"]`  
Assert: `ast.nodes[0]` equals `{ id: "User", kind: "actor", display: "User" }`  
Green when: `actor NAME` matched

**it** parses :actor: shorthand  
Input: `[":User:"]`  
Assert: `ast.nodes[0].kind === "actor"`  
Green when: `:NAME:` regex matched as actor

**it** parses (use case) shorthand  
Input: `["(Login)"]`  
Assert: `ast.nodes[0].kind === "usecase"` and `display === "Login"`  
Green when: `(NAME)` regex matched as use case

**it** parses <<include>> stereotype on dependency  
Input: `["(Login) ..> (Authenticate) : <<include>>"]`  
Assert: `ast.edges[0].stereotype === "include"`  
Green when: `<<include>>` in label captured as stereotype

**it** parses rectangle boundary  
Input: `["rectangle System {", "  (Login)", "}"]`  
Assert: `ast.nodes` contains rectangle node with Login as child  
Green when: rectangle command creates a container node

---

### `tests/integration/class.test.ts`

**it** renders minimal class diagram  
Input: `"@startuml\nclass Foo\n@enduml"`  
Assert: result starts with `<svg`  
Green when: class plugin is registered in dispatcher

**it** renders class with relationship  
Input: `"@startuml\nclass A\nclass B\nA --|> B\n@enduml"`  
Assert: SVG contains text "A", "B", and a line element  
Green when: class parser + dot engine layout + renderer all produce valid output

**it** renders all class fixture files without throwing  
Green when: all class syntax variations handled

---

## Phase 3 — Activity Diagrams

### `tests/unit/activity/parser.test.ts`

**it** parses :action; syntax  
Input: `[":Download file;"]`  
Assert: `ast.nodes[0]` equals `{ kind: "action", label: "Download file" }`  
Green when: `:...; ` regex matched

**it** parses start  
Input: `["start"]`  
Assert: `ast.nodes[0]` equals `{ kind: "start" }`  
Green when: `start` keyword matched

**it** parses stop  
Input: `["stop"]`  
Assert: `ast.nodes[0]` equals `{ kind: "stop" }`  
Green when: `stop` keyword matched

**it** parses if / else / endif  
Input: `["if (condition?) then (yes)", "  :A;", "else (no)", "  :B;", "endif"]`  
Assert: `ast.nodes[0]` is `{ kind: "if", thenBranch: [A], elseBranch: [B] }`  
Green when: if/else/endif recognized and branches collected

**it** parses elseif  
Input: `["if (a?) then", "  :A;", "elseif (b?) then", "  :B;", "else", "  :C;", "endif"]`  
Assert: node has `elseIfBranches` array with one entry  
Green when: elseif inserts intermediate branch in the if structure

**it** parses while loop  
Input: `["while (more items?)", "  :Process;", "endwhile"]`  
Assert: `{ kind: "while", condition: "more items?", body: [Process] }`  
Green when: while/endwhile creates loop node

**it** parses repeat / repeatwhile  
Input: `["repeat", "  :Do thing;", "repeatwhile (again?)"]`  
Assert: `{ kind: "repeat", body: [Do thing], condition: "again?" }`  
Green when: repeat/repeatwhile creates do-while node

**it** parses fork / fork again / end fork  
Input: `["fork", "  :A;", "fork again", "  :B;", "end fork"]`  
Assert: `{ kind: "fork", branches: [[A], [B]] }`  
Green when: fork/fork again accumulates branches; end fork closes fork node

**it** parses swimlane  
Input: `["|Alice|", "  :Do work;", "|Bob|", "  :Review;"]`  
Assert: Alice action has `swimlane: "Alice"` and Bob action has `swimlane: "Bob"`  
Green when: swimlane command sets active lane; subsequent actions tagged with it

**it** parses action color  
Input: `[":Action; #lightblue"]`  
Assert: `ast.nodes[0].color === "#lightblue"`  
Green when: color suffix captured after `;`

---

### `tests/unit/activity/layout.test.ts`

**it** start node is above first action  
Input: start → action  
Assert: `geo.nodes["start"].y < geo.nodes["action0"].y`  
Green when: topological sort places start at row 0

**it** sequential actions have increasing y  
Input: three actions in sequence  
Assert: `y[0] < y[1] < y[2]`  
Green when: each action assigned to next row in topological order

**it** fork bar x spans all branches  
Input: fork with two branches of different widths  
Assert: fork bar width covers both branch column positions  
Green when: fork geometry width = rightmost column - leftmost column

**it** if branches merge at same y after endif  
Input: if/else/endif with one action in each branch  
Assert: node after endif has y equal to `max(then branch end y, else branch end y) + spacing`  
Green when: layout finds join point for if branches

**it** swimlane actions have x constrained to lane  
Input: two swimlanes each with two actions  
Assert: Alice actions and Bob actions have different x ranges that don't overlap  
Green when: swimlane assigns a column range per lane

---

### `tests/unit/activity/renderer.test.ts`

**it** start node is a filled circle  
Assert: SVG contains `<circle` with `fill` set to foreground color  
Green when: start renderer emits filled circle element

**it** stop node is a bullseye (filled circle inside border circle)  
Assert: SVG contains two `<circle` elements for stop node  
Green when: stop renderer emits outer border circle + inner filled circle

**it** action is a rounded rectangle  
Input: one action  
Assert: SVG contains `<rect` with `rx` attribute (corner radius)  
Green when: action renderer emits rect with rx/ry

**it** fork/join bar is a thick filled rectangle  
Input: fork with two branches  
Assert: SVG contains a rect with a large height-to-width ratio or explicit `stroke-width` for bar  
Green when: fork renderer emits a filled rect spanning branch width

**it** swimlane boundaries are vertical lines spanning diagram height  
Input: two swimlanes  
Assert: SVG contains `<line` elements running full diagram height between lanes  
Green when: swimlane renderer emits boundary lines

---

## Phase 4 — Specialized Diagram Types

### `tests/unit/object/parser.test.ts`

**it** parses object declaration  
Input: `["object Alice"]`  
Assert: `ast.objects[0]` equals `{ id: "Alice", display: "Alice" }`  
Green when: `object NAME` matched

**it** parses object with display name and alias  
Input: `["object \"Bob Smith\" as bob"]`  
Assert: `{ id: "bob", display: "Bob Smith" }`  
Green when: alias form parsed

**it** parses field assignment  
Input: `["alice : name = \"Alice\""]`  
Assert: `ast.objects[0].fields[0]` equals `{ name: "name", value: "Alice" }`  
Green when: `ALIAS : NAME = VALUE` matched

**it** parses object link  
Input: `["alice --> bob"]`  
Assert: `ast.links[0]` equals `{ from: "alice", to: "bob" }`  
Green when: relationship line parsed

---

### `tests/unit/timing/parser.test.ts`

**it** parses robust participant  
Input: `["robust \"User\" as U"]`  
Assert: `ast.participants[0]` equals `{ id: "U", display: "User", kind: "robust" }`  
Green when: `robust "NAME" as ID` matched

**it** parses initial state assignment  
Input: `["robust \"User\" as U", "U is Idle"]`  
Assert: `ast.participants[0].initialState === "Idle"`  
Green when: `ID is STATE` matched and applied to participant

**it** parses absolute time marker  
Input: `["@100"]`  
Assert: `ast.timeMarkers` contains `{ time: 100 }`  
Green when: `@N` pattern matched

**it** parses state change at time  
Input: `["@100", "U is Active"]`  
Assert: participant U has a state change to Active at time 100  
Green when: state change `ID is STATE` after time marker is recorded at that time

**it** parses message between participants  
Input: `["@50", "A -> B : msg"]`  
Assert: `ast.messages[0]` is `{ time: 50, from: "A", to: "B", label: "msg" }`  
Green when: message arrow syntax within timing context resolved to current time

---

### `tests/unit/mindmap/parser.test.ts`

**it** parses single root node  
Input: `["* Root"]`  
Assert: `ast.root` equals `{ text: "Root", depth: 1, children: [] }`  
Green when: `*+ NAME` regex matches at depth 1

**it** parses child node  
Input: `["* Root", "** Child"]`  
Assert: `ast.root.children[0].text === "Child"` and depth 2  
Green when: depth = number of leading `*` characters

**it** parses grandchild  
Input: `["* Root", "** Child", "*** Grandchild"]`  
Assert: `ast.root.children[0].children[0].text === "Grandchild"`  
Green when: grandchild is nested under child

**it** parses colored node  
Input: `["* Root", "**[#lightblue] Child"]`  
Assert: `ast.root.children[0].color === "#lightblue"`  
Green when: `[#COLOR]` prefix captured before text

**it** parses OrgMode-style indented syntax  
Input: `["* Root", " ** Child"]` (space-prefixed alternative)  
Assert: child node at depth 2  
Green when: leading spaces + stars both accepted as depth markers

---

### `tests/unit/gantt/parser.test.ts`

**it** parses task with duration  
Input: `["[Task A] lasts 5 days"]`  
Assert: `ast.tasks[0]` equals `{ id: "Task A", duration: 5, unit: "days" }`  
Green when: `[NAME] lasts N UNIT` matched

**it** parses task with absolute start date  
Input: `["[Task A] starts 2024-01-15"]`  
Assert: `ast.tasks[0].startDate` is a Date for Jan 15 2024  
Green when: ISO date string parsed into Date

**it** parses dependency  
Input: `["[Task B] starts after [Task A]'s end"]`  
Assert: `ast.dependencies[0]` equals `{ task: "Task B", after: "Task A", relation: "end" }`  
Green when: `starts after [X]'s end` pattern matched

**it** parses milestone  
Input: `["[M1] happens at [Task A]'s end"]`  
Assert: `ast.milestones[0]` equals `{ id: "M1", at: "Task A", relation: "end" }`  
Green when: `happens at` pattern matched as milestone

---

### `tests/unit/wbs/parser.test.ts`

**it** parses first-level item  
Input: `["+ Root"]`  
Assert: `ast.root.text === "Root"` and depth 1  
Green when: `+` prefix matched at depth 1

**it** parses nested items  
Input: `["+ Root", "++ Child", "+++ Grandchild"]`  
Assert: nesting matches number of `+` characters  
Green when: depth = number of leading `+` characters

**it** parses color annotation  
Input: `["+ Root", "++[#red] Child"]`  
Assert: `ast.root.children[0].color === "#red"`  
Green when: `[#COLOR]` prefix on WBS item captured

---

## Cross-Cutting Test Utilities

### `tests/helpers/render.ts`

Shared helper used by all integration tests:

```typescript
// Wraps render() with a predictable fixed-width measurer
// so layout is deterministic in tests (no canvas needed)
export async function renderFixture(source: string): Promise<string> {
  return render(source, {
    measurer: fixedWidthMeasurer({ charWidth: 8, lineHeight: 16 }),
  });
}

// Reads a .puml fixture file and renders it
export async function renderFile(fixturePath: string): Promise<string> {
  const src = await fs.readFile(fixturePath, "utf8");
  return renderFixture(src);
}
```

### `tests/helpers/svg-assertions.ts`

Custom Vitest matchers:

```typescript
expect.extend({
  toContainElement(svg: string, tag: string) { ... },
  toContainText(svg: string, text: string) { ... },
  toHaveAttribute(element: string, attr: string, value?: string) { ... },
  toBeValidSvg(svg: string) { ... },  // checks XML well-formedness
  toHaveNodeCount(svg: string, tag: string, count: number) { ... },
});
```

### Fixture files

Add `.puml` fixture files to `tests/fixtures/<type>/` as each parser is built.
Start with the examples from the official PlantUML documentation for each type.
Every new syntax feature added should have a corresponding fixture file.
