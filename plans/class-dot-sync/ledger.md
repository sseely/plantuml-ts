# Ledger — non-EQUAL fixtures with a known, accepted reason

Entry format:

```
## <category label>
- Mechanism: <one sentence> (Java: <file:line>; ours: <file:line>)
- Disposition: blocked-on <subsystem> | needs-signoff
- Slugs: <slug, slug, …>
```

(Fixed categories don't belong here — they're commits.)

## !procedure / TIM subsystem — RESOLVED (ported in efcffdf, 2026-07-10)
- The `!procedure` family was ported per maintainer approval; cuxaji,
  gazimo, romuco (+ bulena, lifuki from the iter-1 E group) converged.
  bixogo-47-xulu385 / roxosu-00-pini153 remain non-EQUAL on a DIFFERENT
  mechanism (legend-region dispatch, below). `!import`/`!include` stay
  deferred past v1.0 (DIVERGENCES.md, README.md "Preprocessor scope").

## legend/endlegend region not excluded from dispatch or parsing
- Mechanism: no code treats `legend`…`endlegend` as an excluded region;
  salt-widget lines inside a legend (`()one`, `[ok]`) trip
  `ELEMENT_SHORTHAND_PATTERNS` (src/core/descriptive-keywords.ts), so
  `classAccepts` declines and the block misroutes to the description
  plugin, which drops `class foo` and invents entities from the legend
  text. (Java: legend is captured as display-only by CommandLegend /
  DisplaySection — never parsed as diagram content; ours:
  src/diagrams/class/class-dispatch.ts + src/core/descriptive-keywords.ts
  + src/core/dispatcher.ts, none legend-aware)
- Disposition: pending fix — dispatch-side handling may fit the class
  write-set (class-dispatch.ts); a general fix touches src/core/
  dispatcher.ts / descriptive-keywords.ts (outside write-set, would need
  maintainer extension).
- Slugs: bixogo-47-xulu385, roxosu-00-pini153

## %retrieve_procedure builtin unimplemented
- Mechanism: TIM port covers %invoke_procedure only;
  xadado-92-lazo250 exercises %retrieve_procedure (tim/builtin/
  RetrieveProcedure.java). In-write-set follow-up (src/core/tim/).
- Disposition: pending fix (small, queued)
- Slugs: xadado-92-lazo250
