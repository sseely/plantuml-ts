# T6 — Rewrite the 4 USymbol icon geometries faithfully + per-element color

## Context
The four descriptive USymbol icons in `src/core/usymbol-shapes.ts` are
unfaithful to upstream (mission evidence #4, plus #2 for color): the
database cylinder uses a proportional `ry` instead of upstream's fixed
10px cubic-bezier caps, the component tabs are wrong, and all four pull
their color from the class bucket instead of their own SName. Per
`../decisions.md` Porting stance — the existing shapes carry no
preservation claim — **rewrite the four shape functions from scratch to
mirror the Java geometry** cited in `../decisions.md`, "USymbol geometry".

## Task
Rewrite the database/component/actor/usecase renderers in
`src/core/usymbol-shapes.ts` to reproduce the exact upstream geometry:

- **Database** (`USymbolDatabase.java:61-87`): one `UPath`, cubic (`C`)
  caps, fixed **10px** cap depth (not a function of height). Body:
  `moveTo(0,10); C(0,0,w/2,0,w/2,0); C(w/2,0,w,0,w,10); L(w,h-10);
  C(w,h,w/2,h,w/2,h); C(w/2,h,0,h,0,h-10); L(0,10)`. Front mouth arc:
  `moveTo(0,10); C(0,20,w/2,20,w/2,20); C(w/2,20,w,20,w,10)` (front lip at
  y=20). Content top margin **24**, `suppHeight` **15**.
- **Component (UML2)** (`USymbolComponent2.java:59-75`): rounded rect body
  plus right-edge tabs — outer tab `15×10` at `(w-20, 5)`; two inner ticks
  `4×2` at `(w-22, 7)` and `(w-22, 11)`.
- **Actor** (`skin/ActorStickMan.java:51-96`): head circle Ø16 at top; body
  translated `(cx, 16)`: spine `(0,0) -> (0,27)`; arms `(-13,8) -> (13,8)`;
  legs `(0,27) -> (∓13,42)`.
- **Usecase** (`USymbolUsecase.asSmall` + `TextBlockInEllipse.java:50-66`):
  ellipse sized to the text footprint `.bigger(6)` (+6px on each axis);
  text centered with a `dy-2` baseline offset.

Each shape function takes its fill/stroke as a `Paint` resolved via
`resolveElementPaint(theme, sname, role)` (T3) for its own SName
(`database`/`component`/`actor`/`usecase`), and calls the T2 Paint-aware
`svg.ts` primitives to draw. Delete the old approximate shape bodies
entirely rather than branching on a flag — this is a from-scratch rewrite
per the Porting stance, not a patch.

## Write-set
- `src/core/usymbol-shapes.ts`
- `src/core/usymbol-shapes.test.ts`

## Read-set
- `../decisions.md#D4`, `#D5`, and the "USymbol geometry" citation block
  (all four shapes' exact coordinates)
- `src/core/svg.ts` — T2's Paint-aware `rect`/`ellipse`/`path`/`polygon`
  helpers
- `src/core/theme.ts` — T3's `resolveElementPaint`

## Architecture decisions
- D4: each shape resolves its own color via `resolveElementPaint(theme,
  sname, role)` — no shape may read a hard-coded class-bucket field.
- D5: exact-geometry fidelity is scoped to these four USymbols only
  (database, component, actor, usecase). Other symbols (node, cloud,
  folder, …) are out of scope for this task and stay as rects.

## Interface contracts
Consumes T2 (Paint-aware svg primitives) and T3 (`resolveElementPaint`).
Consumed by T7/T8 (Batch 4 descriptive renderers), which look up a shape
function by SName — do not change the existing per-symbol dispatch
signature/shape-function names beyond what's needed to accept a `Paint`.

## Acceptance criteria
1. Given the database icon, when rendered, then its path data contains
   cubic (`C`) segments with a fixed 10px cap depth, independent of the
   icon's total height.
2. Given the component icon, when rendered, then it contains a `15×10`
   rect at `(w-20, 5)` and two `4×2` rects at `(w-22, 7)` and `(w-22, 11)`.
3. Given `sname='database'` with a database-bucket color set via T3/T4/T5,
   when the database icon renders, then it fills with that bucket's
   color — NOT the class-bucket color.
4. Given the actor icon, when rendered, then it contains a head circle of
   diameter 16 and spine/arms/legs segments at the cited coordinates
   (spine `(0,0)->(0,27)`, arms `(-13,8)->(13,8)`, legs to `(∓13,42)`,
   relative to the body's `(cx,16)` translation).

Deps: T2, T3.

## Observability
N/A — pure synchronous library.

## Rollback
Reversible (git revert; no persistent state).

## Quality bar
`npm run typecheck && npm test && npm run lint && npm run build` all green.
Coverage 90/90/90 for `src/core/usymbol-shapes.ts`. Re-run the DOT-parity
probe (`../decisions.md#dot-parity`) — expect no change (icon geometry is
drawn post-layout; DOT structure must not move).

## Commit
One commit for this task: `feat(T6): rewrite USymbol icons to match upstream geometry`.
Body references decisions.md#D4/#D5/"USymbol geometry" (why: the existing
four icons used approximate proportional geometry and class-bucket color
instead of upstream's fixed measurements and per-element SName color).
