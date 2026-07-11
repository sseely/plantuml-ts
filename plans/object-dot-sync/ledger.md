# Divergence ledger — object-dot-sync (A3)

Per loop-protocol.md step 8 and decisions.md#d4. Every comparable fixture not
structurally EQUAL is recorded here with its root-cause label. Entries are
DRAFTS pending maintainer validation (push-forward condition: drafting is
in-mission; sign-off is not).

## Non-EQUAL comparable fixtures (2 of 80)

| Slug | Root cause | Detail |
|------|-----------|--------|
| zicope-62-pica490 | `creole-embedded-diagram` | Map rows whose values are `{{ ... }}` creole embedded sub-diagrams (built via `!procedure` + `%breakline()` — the preprocessor expands these correctly; verified). The oracle runs a graphviz pass per embedded sub-diagram (6 svek dumps: label→label pairs under `left to right direction`); rendering nested PlantUML diagrams inside a creole cell is an unimplemented subsystem (creole/klimt land, `src/core/**`) outside this mission's write-set (stop condition 1). |
| zuvila-56-nuda425 | `creole-embedded-diagram` | Same mechanism inside a `legend` block (`{{ ... }}` with `\n` escapes). |

## Oracle-blind (excluded from the comparable denominator)

| Slug | Root cause | Detail |
|------|-----------|--------|
| robitu-34-vupe367 | `pragma-layout` | `!pragma layout …` — the jar only dumps svek DOT under the graphviz path; no oracle DOT exists to compare against (report classifies as oracle-blind). |

## No canonical SVG (jar crashes — never enter the report)

| Slug | Root cause | Detail |
|------|-----------|--------|
| delisi-38-bupi176 | `jar-crash` | Canonical SVG generation crashed (see decisions.md#d4 — incl. a `DecorateEntityImage` NPE among these three). No oracle artifact of any kind. |
| dulone-62-neri182 | `jar-crash` | Same class of failure. |
| losote-76-beki147 | `jar-crash` | Same class of failure. |

## Size backlog (structurally EQUAL, sizes not yet exact)

Not divergences — tracked in `oracle/goldens/object/size-backlog.json`
(29 entries at close; ratchet-down only, absent slug = exact required).
Known surviving mechanisms (journaled in Phase L iter 7):
bracket-attribute endpoint declarations (fonulu-92), descriptive-USymbol
icon sizing under allow_mixing (gapisu-00 family), endpoint-only entities
defaulting to class sizing (tobuka-93 hypothesis), stacked-stereotype
label splitting (fafozi-27), unapplied `<style>` blocks (lisepi-64).
