# Architecture Decisions

## D1: Java layout engine scope — gtile primary, ftile reference

**Decision:** Study `gtile/` deeply. Dip into `ftile/` only when gtile has
a gap or an unclear pattern.

**Rationale:** gtile is the currently active engine in upstream. ftile is
older and largely superseded. Reading both deeply would add ~53 files for
marginal gain.

## D2: Parser review depth — catalog only

**Decision:** For `command/` (46 files), produce a catalog: command name,
syntax pattern, which Instruction class it produces. No deep read of
individual command implementations.

**Rationale:** The gaps between 46 commands and our parser are the
deliverable, not the command implementations. Our parser works; we need
to know what it's missing.

## D3: Branch

**Decision:** `arch/activity-review` branched from `main`.

**Rationale:** Review is conceptually separate from feature work. Keeps
plans/ docs out of feature branch diffs.

## D4: Skinparam stop threshold

**Decision:** Stop only if Java reveals a primitive with **no equivalent
anywhere in `src/core/`**. Extending the existing `skinparam.ts` for
activity-specific keys is implementation work, not a blocker.

**Rationale:** We have `src/core/skinparam.ts` (321 lines) and
`src/core/theme.ts` (205 lines). These cover global and element-type-level
params. Activity-specific extensions (`ActivityBackgroundColor`, per-node
`#color`) are additive, not ground-up builds.
