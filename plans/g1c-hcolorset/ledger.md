# G1c ledger

## K1 — HColorSet named-color table port + wiring — FIXED (closes I2/T19)

### Mechanism
- `src/core/paint.ts` and `src/core/tim/builtin/color-utils.ts` (and,
  transitively, every entry point that flows through them) had NO
  `HColorSet` name -> hex table — named CSS/PlantUML colors (`green`,
  `orange`, `AliceBlue`, ...) passed through the SVG-emission layer
  verbatim instead of resolving to the jar's canonical uppercase hex
  (`green`->`#008000`), case was not normalized (`#ffffff`->jar's
  `#FFFFFF`), a 3-digit hex was not expanded (`#333`->jar's `#333333`),
  and a bare (no leading `#`) hex value produced literally-invalid SVG
  (`fill="0000ff"` instead of `fill="#0000FF"`). Pre-existing,
  already-documented gap (T19, G1 ledger.md § I2, extended by § I10 to
  `<linearGradient>` stop-color values and the bare-hex form).
- Root cause traced to origin: `~/git/plantuml/.../klimt/color/
  HColorSet.java#parseSimpleColor` delegates named-color resolution to
  `ColorTrieNode.java`'s static-initializer table (154 `register(name,
  XColor)` calls — 147 standard CSS/SVG/HTML names, verbatim, PLUS 7
  non-CSS Archimate-only names with no CSS equivalent at all:
  `BUSINESS`, `APPLICATION`, `MOTIVATION`, `STRATEGY`, `TECHNOLOGY`,
  `PHYSICAL`, `IMPLEMENTATION`). This port had no equivalent table
  anywhere in the codebase (grep-verified before starting).

### Fix
- Ported the table verbatim: `src/core/klimt/color/ColorTrieNode.ts`
  (154 entries, every name/hex value cross-checked line-for-line
  against the Java source; a lowercase-keyed `Map` — behaviorally
  identical to upstream's letter-only 26-way trie, see decision
  journal). `src/core/klimt/color/HColorSet.ts` ports
  `parseSimpleColor` (hex 1/3/6/8-digit forms, falling through to the
  named table for ANY length when the hex parse itself fails — matches
  upstream's if/else-if-chain-then-trailing-return structure exactly,
  e.g. `"red"`/`"orange"` are not valid hex but resolve via the named
  table), `toSvgHex` (`XColor#toSvg`'s exact canonical format:
  `#RRGGBB` uppercase opaque, `#00000000` for alpha 0, `#RRGGBBAA`
  uppercase otherwise), and `resolveColorToSvgHex` (the single choke-
  point resolver: keyword collapse + hex/name resolution, unresolvable
  input returned UNCHANGED — see decision journal for why no WHITE
  fallback).
- Wired at exactly TWO choke points (not per-call-site copies — see
  decision journal for the grep verification that these are the ONLY
  `fill`/`stroke`/`stop-color` emission sites in the whole SVG driver
  layer):
  1. `src/core/paint.ts#paintToSvg` (plain-string branch AND both
     gradient stop values) + `isPlainColor` (now a real name-table
     membership check via `parseSimpleColor`, replacing a pre-G1c
     "any alphabetic string counts as a color" heuristic) +
     `isTransparentColor` (extended to the `"background"` keyword,
     matching `HColorSet.java:82-83`).
  2. `src/core/klimt/drawing/svg/svg-graphics-core.ts`'s `fixColor`
     (fill AND stroke — both `setFillColor`/`setStrokeColor` funnel
     through it), `createSvgGradient` (both stop-color values — the
     I10 gradient-stop finding), and `setupBackcolor` (root
     `<svg style="background:...">` + backing `<rect>`).
- `src/core/tim/builtin/color-utils.ts` (7 TIM color builtins:
  Darken/Lighten/HslColor/IsDark/IsLight/ReverseColor/
  ReverseHsluvColor) rewired to delegate `parseColorString` to the
  same `HColorSet.ts#parseSimpleColor`, deleting its own ~40-name
  compact duplicate table and closing its own self-documented
  "disclosed divergence" comment.

### Table provenance
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/color/
  ColorTrieNode.java` (the table itself, in a static initializer) +
  `HColorSet.java` (the parse-order logic, `parseColor`/
  `parseSimpleColor`).
- 154 entries total: 147 standard CSS3/X11/SVG named colors (values
  cross-checked, none differ from the CSS standard) + 7 Archimate-only
  names with NO CSS equivalent (`BUSINESS #FFFFCC`, `APPLICATION
  #C2F0FF`, `MOTIVATION #CCCCFF`, `STRATEGY #F8E7C0`, `TECHNOLOGY
  #C9FFC9`, `PHYSICAL #97FF97`, `IMPLEMENTATION #FFE0E0`) — the
  concrete evidence a verbatim port (not a "standard CSS list from the
  internet") mattered per this iteration's brief.

### Sample verification (8 fixtures, jar cached SVG as oracle,
### exceeds the 6-fixture minimum)
| Name | Fixture | Jar hex | Ours (after) |
|---|---|---|---|
| `aliceblue` | component/bisedo-29-kone620 | `#F0F8FF` | `#F0F8FF` |
| `blue` | component/bisedo-29-kone620, raxata-43-buni314 | `#0000FF` | `#0000FF` |
| `yellow` (gradient stop) | component/raxata-43-buni314 | `#FFFF00` | `#FFFF00` |
| `red` (gradient stop) | component/raxata-43-buni314 | `#FF0000` | `#FF0000` |
| `gold` | component/cukafa-49-fona812 | `#FFD700` | `#FFD700` |
| `orange` (stroke) | component/cukafa-49-fona812 | `#FFA500` | `#FFA500` |
| `grey` | component/bokumi-45-pupo531 | `#808080` | `#808080` |
| `Aqua` | component/betidu-24-xuku720 | `#00FFFF` | `#00FFFF` |

`titona-45-jile471` (class-diagram `<style>document{Backgroundcolor
pink}>`/`#red|green` gradient) — the same `paint.ts` mechanism now
resolves it, but class diagrams have no cached golden SVG in this
corpus (DOT-only gate for this diagram family); mechanism verified via
the 8 fixtures above and the full 355-fixture per-fixture diff scan
instead.

### Census (DeterministicMeasurer, component+usecase, 355 fixtures)
- Before: 41/355 conformant, 1-3:28, 4-10:86, 11-30:60, 31+:139, errors:1
- After: **48/355** conformant, 1-3:28, 4-10:81, 11-30:62, 31+:135, errors:1
- Full-corpus per-fixture (not just bucket-aggregate) before/after
  diff-count scan (git-archive pristine-snapshot technique, I-linkstyle/
  I9b precedent): **0 regressions**, 53 fixtures improved (strictly
  fewer diffs), 301 unchanged, 1 error fixture unchanged (pre-existing
  malformed-XML jar golden, I0-ledgered, unrelated). All 7 newly-zero
  fixtures confirmed present in the after-set alongside all 41
  baseline fixtures (none lost).
- Ratchet: 41 -> **48** pinned (7 new: component/cedosa-23-nini915,
  component/cusubu-18-xacu379, component/veboxo-36-nupe102,
  component/vonipa-26-pudo091, component/zijaro-25-kufa588,
  usecase/dijico-15-cabu824, usecase/mofuba-79-came821 — all
  DOT-EQUAL per `parity.json`, zero-diff under `DeterministicMeasurer`,
  `description.golden.ratchet.test.ts` 51/51 pass).
- This closes `oracle/goldens/svg-description/README.md`'s own
  "Known gap (T18 finding)" note: "no conformant fixture using a NAMED
  CSS color" — 7 of the 48 conformant fixtures now exercise named
  colors directly (`aliceblue`, `blue`, `gold`, `grey`, `orange`, ...).

### Accounting re-attribution (G1b ledger § J3 rows)
- "I2 named-CSS-color->hex table gap (T19)" (23 fixtures, dominant-
  signature classification, no explicit slug list in the source
  ledger) — **CLOSED as a mechanism**. The 7 fixtures that crossed to
  zero-diff this iteration confirm the mechanism is fixed; the
  remaining ~16 of the original 23 (not individually re-classified
  this iteration — no explicit slug list existed to re-verify against)
  most likely now carry a DIFFERENT dominant signature (their color
  diffs are fixed, but they were dominant-classified as "color" only
  because color was their LARGEST diff family, not their ONLY one — a
  fixture with a residual geometry-cascade diff plus a now-fixed color
  diff will show its next-largest family after this fix). A full
  re-derivation of the residue-accounting table (dominant-signature
  reclassification of all ~307 remaining non-conformant fixtures) is
  out of this iteration's scope — the mechanism fix and its
  jar-verified sample are the deliverable; a fresh full-corpus
  dominant-signature classification is future work if a subsequent
  iteration needs it.
- "I2 named-color gap — extended reach (gradient stop-color +
  bare-hex-no-`#`)" (2 fixtures: component/raxata-43-buni314,
  titona-45-jile471) — **CLOSED as a mechanism** for both. raxata
  jar-verified directly (gradient stops above); titona (class diagram,
  no cached golden) verified via the shared `paint.ts` mechanism + the
  `paintToSvg`/`svg-graphics-core.ts` test suites' dedicated gradient-
  stop-resolution and bare-hex tests.

### Named remainders (not fixed this iteration, ledgered)
- `HColorSet#parseColor`'s `?back:fore[:extra]` dual-color scheme form
  (`HColorScheme`) — not ported. 1 corpus fixture found
  (`component/degici-07-kura718`), not in the G1b ledger's named
  fixture accounting, mission brief hedged it as maybe-in-scope.
  deferred-needs-signoff if a future fixture surfaces it.
- `"automatic"` keyword (`HColorAutomagic`) — not ported. Resolves to
  a context-dependent color chosen from the current background at
  DRAW time, not a static hex value; a materially different mechanism
  from a name-table lookup. deferred, unbuilt subsystem.
- `src/diagrams/activity/renderer.ts`'s start/stop/end circle nodes
  build `fill="${...}"`/`stroke="${...}"` via raw template-string
  interpolation, bypassing BOTH choke points this iteration fixed
  entirely (confirmed: `activityStartColor`/`activityEndColor` tests
  still assert literal `fill="blue"`/`fill="yellow"` unchanged).
  Activity diagrams are outside this iteration's census/DOT-gate/
  fixture-accounting scope. deferred-needs-signoff, future iteration.
- Full residue-accounting re-derivation for the ~307 still-non-
  conformant fixtures (dominant-signature reclassification) — not
  performed this iteration (see "Accounting re-attribution" above).
  deferred, future iteration if needed.
