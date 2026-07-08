# Mission — Render fidelity: faithful color/gradient + per-element skinparam

Make the plantuml-ts SVG rendering layer faithful to upstream on **color**: emit
real SVG gradients for `color1\color2` skinparam values, resolve
`BackgroundColor`/`BorderColor`/`FontColor` **per element type** (a `database` is
not a `class`), adopt upstream's grey default skin, and port the four measured
descriptive-element USymbol geometries exactly. Grounded in a visual-QA gap
analysis of five fixtures against the local upstream jar (`plantuml-1.2026.7beta3`)
and cited upstream source (`klimt/color`, `decoration/symbol`, `svg/SvgGraphics`).

> **Read this whole file + `decisions.md` before writing code.** The six
> architecture decisions (D1–D6) are settled and must not be relitigated. The
> exact upstream geometry/gradient numbers live in the task files — port them
> verbatim, do not re-derive. This is a **rendering** mission: DOT structure is
> unaffected and must not move (parity gate below).

## The evidence that created this mission
Visual gap analysis (`scratchpad/vqa/*.cmp.png`, this session) of A3 descriptive-icon
fixtures vs the jar found, in priority order:
1. **CRITICAL** — gradient skinparam `color1\color2` emitted as a literal
   `fill="#c3d8f4\#6192d1"` → invalid SVG → **renders black**. Upstream emits a real
   `<linearGradient>` def + `url(#id)`.
2. Per-element skinparam scoping missing — a `database` element fills with the **class**
   `BackgroundColor`; there is no `databaseBackground` bucket.
3. Default fill divergence — port renders `#FEFECE` yellow; upstream's authoritative
   Style default is `#F1F1F1` grey / `#181818` border.
4. Database cylinder squashed — port uses proportional `ry`; upstream uses **fixed 10px**
   cubic-bezier caps.
5. Plain `--` association drawn with a filled arrowhead.

Full upstream citations in `decisions.md`. Fixtures: `givofi-11`, `popesa-39`
(database+gradient), `cacoma-43` (actor/component/usecase, default color), `lojiga-09`
(component container, default color).

## Branch
`feature/render-fidelity` off `main`. Merge commit (not squash) — per-task commit IDs
are referenced in `decision-journal.md`.

## Constraints (stop / push-forward)
**STOP and wait for a human when:**
- A change requires editing a file outside the task's declared write-set (and it is not
  in any other task's write-set).
- Two consecutive quality-gate failures on the same check.
- DOT structural parity drops below the baseline (350 class / 221 component / 41 usecase)
  — a rendering change must never move DOT. This is the canary for scope leak.
- A decision D1–D6 would have to be contradicted to make a task pass.
- T9's baseline-refresh surface exceeds ~20 test files (signals the default-flip is
  hitting more than color assertions — re-scope before mass-editing).

**PUSH FORWARD with judgment when:**
- A color/geometry constant is unambiguous in the cited upstream source — port it.
- A pre-existing renderer test asserts the old `#FEFECE` default (T9 only) — update it to
  the new grey; that is the task, not a surprise.
- The choice is stylistic and DOT-invariant.

## Quality gates (run between every batch)
| command | pass | on_fail |
|---|---|---|
| `npm run typecheck` | exit 0 | fix_and_rerun |
| `npm test` | exit 0, coverage 90/90/90 | fix_and_rerun |
| `npm run lint` | exit 0 | fix_and_rerun |
| `npm run build` | exit 0 | fix_and_rerun |
| DOT parity probe (see `decisions.md#dot-parity`) | 350/221/41 unchanged | stop |
| `git diff --name-only` vs task write-set | matches only | stop |

## Batches
| # | Focus | Tasks | Status |
|---|-------|-------|--------|
| 1 | [Paint foundation](batch-1/overview.md) | T1 | [x] |
| 2 | [Type + primitive layer](batch-2/overview.md) | T2, T3 | [x] |
| 3 | [Skinparam + geometry](batch-3/overview.md) | T4, T5, T6 | [x] |
| 4 | [Descriptive renderers](batch-4/overview.md) | T7, T8 | [ ] |
| 5 | [Default-skin flip (isolated churn)](batch-5/overview.md) | T9 | [ ] |

## Index
- [`decisions.md`](decisions.md) — D1–D6 (settled) + upstream citations + DOT-parity probe.
- [`diagrams/component-map.md`](diagrams/component-map.md) — module dependency graph.
- [`diagrams/data-flow.md`](diagrams/data-flow.md) — color resolution flow.
- [`decision-journal.md`](decision-journal.md) — appended during execution.

## Sequencing rationale (why D2 is last)
The default-color flip (D2) recolors every class/object/descriptive diagram, moving
baselines project-wide. Isolating it to the final task (T9) keeps every prior batch green
under the old `#FEFECE` default, so machinery (gradient, per-element, geometry) lands and
is validated independently, and the broad recolor is one reviewable commit. Fixtures that
set explicit skinparam colors (givofi/popesa) validate before the flip; default-colored
fixtures (cacoma/lojiga) validate after.
