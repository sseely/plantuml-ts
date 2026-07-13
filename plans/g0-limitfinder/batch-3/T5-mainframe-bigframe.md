# T5 — Mainframe BigFrame via the description ink box (escape hatch stands)

## Context

G0b/T9 deferred mainframe drawing because BigFrame sizes off
`TextBlockUtils.getMinMax` ink extents (DIVERGENCES.md § General,
"mainframe <label> — parsed, not yet rendered"). T1 ported that machinery;
T3 gives the description renderer a real LimitFinder pass. decisions.md D5
locks the scope: EXACTLY two branches —

(a) implement BigFrame where a REAL ink box exists — the description
    engine's klimt pass — and narrow the DIVERGENCES entry to
    string-fragment engines only; or
(b) keep the divergence TEMPORARY everywhere with the updated rationale
    (LimitFinder ported; blocked now only on fragment-string ink boxes).

NO SVG-string extent walker (D5). Choose (a) if the description-side wiring
is clean; (b) if it forces contortions (journal the evidence).

## Task (branch (a))

Port `BigFrame` (klimt/shape/BigFrame.java) faithfully: extends the
TextBlockMemoized pattern (or our closest equivalent — check
src/core/klimt/shape/ for TextBlockMemoized); `getEffectivePadding` =
padding.incTop(titleH + 10); `computeWidth` = padL + max(ww+12, titleW+10)
+ padR where `ww = inkMinX >= 0 ? inkMaxX : inkWidth`; `computeHeight` =
padT + titleH + hh + padB (same min>=0 rule); `drawU` = rounded URectangle
(symbolContext roundCorner/shadow) + the folded-tab UPath
((textWidth,0) → (textWidth,textHeight−cornersize) →
(textWidth−cornersize,textHeight) → (0,textHeight); textWidth = titleW+10
or widthFull/3; cornersize 10 or 7; textHeight = titleH+3 or 12) + title
at UTranslate(3,1) (skip the SpecialText wrapper — compression-only,
document the omission). Port `decorateWithFrame`'s margin/padding/delta
composition (DiagramChromeFactory.java:257-318): frame translated by
margin; content by margin∘padding∘computeDelta (negative-ink pullback).
Wire it INSIDE the description render path (the only place with a real
TextBlock tree + LimitFinder), styled from `styles.mainframe` (already in
AnnotationStyles: padding 1/5/1/5, margin 10/5/10/5, lineThickness 1.5).
Jar-verify with `@startuml\nmainframe demo\n[a] --> [b]\n@enduml`
(description-routed!) — pin the frame rect dims/translate relations from
the jar output. Update DIVERGENCES.md: entry narrows to "not drawn for
string-fragment engines (class/state/sequence/…)"; update
tests/unit/annotations-mainframe.test.ts (its own doc says to rewrite it
the day BigFrame lands) — chrome fragment path for OTHER engines still
no-ops on mainFrame (keep those pins).

## Task (branch (b))

Update the DIVERGENCES entry rationale (LimitFinder now ported; residual
blocker = fragment strings carry no drawable tree), journal the evidence,
keep all current tests.

## Read-set

- decisions.md D5; DIVERGENCES.md § mainframe entry
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/shape/BigFrame.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/DiagramChromeFactory.java:257-318`
- `src/core/annotations/{chrome.ts:200-240,style.ts (mainframe entry),model.ts}`
- `src/diagrams/description/renderer.ts` (post-T3), `src/core/klimt/shape/` inventory
- `tests/unit/annotations-mainframe.test.ts` (:1-90 incl. its self-retiring doc)
- Hook playbook; tests in tests/unit/; no git mutations; do not commit; full
  suite allowed (you run alone).

## Acceptance criteria

- Branch (a): `mainframe demo` on a component diagram draws the frame +
  tab + title with jar-relation-verified geometry; no-mainframe output
  byte-identical; other engines' mainframe still no-op (pinned);
  DIVERGENCES narrowed; full gates green.
- Branch (b): DIVERGENCES + journal updated; zero code change; gates green.

## Quality bar: gates; DOT gate at post-T2 baseline; census must not drop.
## Observability: N/A. Rollback: Reversible.
## Commit: `feat(T5): mainframe BigFrame for the description engine` or `docs(T5): update mainframe deferral rationale` (orchestrator)
