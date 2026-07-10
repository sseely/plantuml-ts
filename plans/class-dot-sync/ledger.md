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
- Disposition: needs-signoff (whole-subsystem port, comparable in scope to
  stdlib !include — not a contained regex fix; scope/priority is a
  maintainer decision). Added 2026-07-10, awaiting maintainer validation.
- Slugs: cuxaji-51-fozu735, gazimo-19-tebe871, romuco-53-sesu052,
  bixogo-47-xulu385, roxosu-00-pini153
