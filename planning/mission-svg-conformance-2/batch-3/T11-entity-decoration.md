# T11 — Entity decoration: DecorateEntityImage → UGroup/UComment

## Context
The jar wraps every entity in `<g class="entity"
data-qualified-name="…">…</g>` preceded by `<!--entity X-->`. Upstream
draws these via svek code (`DecorateEntityImage` and the code that
stamps the group attrs), through the `UGroup`/`UComment` shapes Brief 1
ported. The harness strips `data-*` and comments for comparison, but the
emitted document must still carry them (D4′ preamble spirit: Brief 2
inherits a root-comparable, decoration-complete document).

## Task
Port `src/core/svek/DecorateEntityImage.ts` (and whatever adjacent svek
code actually emits the group/comment — grep `qualified` and
`UComment` under `~/git/plantuml/.../svek/` to find the exact emitters;
port those code paths under their upstream names, journal what was
found). Result: a wrapper that takes an entity's drawing (TextBlock
seam from T3) plus its name/qualified-name and draws
comment → startGroup → inner drawU → closeGroup through a klimt
UGraphic, exactly as upstream sequences them.

## Write-set
- `src/core/svek/DecorateEntityImage.ts` (+ small upstream-named
  companions if the emitters live elsewhere — journal)
- `tests/unit/core/svek/decorate-entity.test.ts`

## Read-set
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/svek/DecorateEntityImage.java`
- svek callers that stamp `class="entity"`/`data-qualified-name` (find)
- `src/core/klimt/shape/{UGroup,UComment}.ts`, `u-graphic-svg.ts`
  (startGroup/closeGroup)

## Interface contracts (consumed by T14, T17)
`DecorateEntityImage` wrapping any TextBlock-seam drawable with the
entity group/comment decoration.

## Acceptance criteria
1. Given a wrapped drawable named `X` with qualified name `p.X`, when
   drawn, then output contains `<!--entity X-->` +
   `<g class="entity" data-qualified-name="p.X" …>` in upstream's attr
   order, verified against a cached jar SVG's wrapper (cite fragment).
2. Given the harness, then normalized comparison of decorated vs
   undecorated inner content differs only where the jar's does (the
   wrapper survives emission, is stripped identically on both sides).

## Observability / Rollback
N/A. / Reversible.

## Quality bar
Standard gates green; ≥90/90/90.

## Commit
`feat(T11): port DecorateEntityImage entity group/comment decoration`
