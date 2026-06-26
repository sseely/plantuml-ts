# Activity Diagram Architectural Review

## Objective

Study the upstream Java PlantUML activity diagram v3 implementation and
compare it to our current TypeScript port. Produce a gap analysis and
architectural brief that will directly drive a reimplementation mission.

This is a **read-only research mission**. No source code changes. The sole
deliverable is `plans/activity-review/brief.md`.

## Branch

`arch/activity-review` (off `main`)

## Quality Gates

No code changes → no build/test gates. The gate is:
- `plans/activity-review/brief.md` exists and is ≤ 500 lines
- Brief contains all required sections (see T3 spec)

## Batches

| Batch | Description | Status |
|-------|-------------|--------|
| [Batch 1](batch-1/overview.md) | Parallel reads: Java model + TypeScript current | [x] |
| [Batch 2](batch-2-synthesize.md) | Synthesis → brief.md | [x] |

## Stop Conditions

- Java source reveals a primitive that has **no equivalent anywhere in `src/core/`** → flag as prerequisite, stop and document
- T1 and T2 reach contradictory conclusions → stop before T3 runs
- Any write outside the declared write-set is needed → stop

## Push Forward

- A Java class too large to read fully → summarize structure + key methods, note it was skimmed
- A Java construct has no direct TS equivalent but a close analogue → map it, note the gap
- Brief exceeds 500 lines → split into `brief-java.md` + `brief-ts.md`, update README links
- ftile/ has something gtile/ dropped → include in notes, don't stop to investigate

## Documents

- [decisions.md](decisions.md) — pre-made architecture decisions
- [batch-1/overview.md](batch-1/overview.md) — parallel read tasks
- [batch-1/T1-java-model.md](batch-1/T1-java-model.md) — Java source read task
- [batch-1/T2-ts-current.md](batch-1/T2-ts-current.md) — TypeScript source read task
- [batch-2-synthesize.md](batch-2-synthesize.md) — synthesis task (T3)
- [diagrams/component-map.md](diagrams/component-map.md) — component comparison
- [decision-journal.md](decision-journal.md) — appended during execution
- **[brief.md](brief.md)** — final deliverable (written by T3)
