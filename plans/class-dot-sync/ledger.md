# Ledger — non-EQUAL fixtures with a known, accepted reason

Entry format:

```
## <category label>
- Mechanism: <one sentence> (Java: <file:line>; ours: <file:line>)
- Disposition: blocked-on <subsystem> | needs-signoff
- Slugs: <slug, slug, …>
```

(Fixed categories don't belong here — they're commits.)

## !procedure / macro-invocation preprocessing (TIM subsystem)
- Mechanism: `!procedure`/`!unquoted procedure`/`%invoke_procedure` and
  call-site expansion are entirely unimplemented in `preprocess()`; leaked
  macro text is parsed as literal diagram/legend content, producing false
  single/double classifier counts or misrouting the whole block to the
  description plugin. (Java: tim/EaterDeclareProcedure.java:47-63,
  tim/TFunctionImpl.java, tim/builtin/InvokeProcedure.java; ours:
  src/core/preprocessor.ts — no matching directive in the table at :48-68)
- Disposition: **approved-for-port** (maintainer decision 2026-07-10) —
  the `!procedure`/`!function` TIM macro engine WILL be ported; these 5
  slugs return to the Phase L fix queue and this entry is removed once
  they converge. Explicitly out of scope alongside it: `!import` /
  `!include` external-source resolution, deferred past v1.0 (needs a
  TS/JS-friendly folding design; documented in DIVERGENCES.md and
  README.md "Preprocessor scope").
- Slugs: cuxaji-51-fozu735, gazimo-19-tebe871, romuco-53-sesu052,
  bixogo-47-xulu385, roxosu-00-pini153
