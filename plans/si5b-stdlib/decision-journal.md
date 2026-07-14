# SI5b+E2r decision journal

| When | Task | Decision | Why | Flag |
|---|---|---|---|---|
| 2026-07-14 | brief | Interactive plan-mission with maintainer-confirmed decisions D1-D9 (capture-all/publish-audited, four packages incl. -all meta sans GPL, verbatim hard constraint, sync Decompressor port, stored-block PNG + data-URI pass-through, skinparam-owned sprite registry). | chat rulings 2026-07-13/14 | no |
| 2026-07-14 | batch-1 | GATES PASSED (orchestrator-run): 8045/8045 (301 files, +36), typecheck/lint/build clean, DOT FROZEN exact, vendor --verify clean (34587 files). T1: split manifests (root index + per-bundle, ~3.5MB committed; single file would be ~5MB). T3 divergence: alias-cycle guard (upstream would hang). T2 new hook lesson: new Array<T>() generics trip lizard's <>-misparse — avoid the pattern. No CI test workflow exists at all (only docs.yml) — T9/T10 note. | agent reports + gate run | no |
