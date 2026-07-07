# Batch 0 — Investigation (no `src/` edits)

Output: (1) the keyword→LeafType→USymbol→svek-shape table, (2) the Tier-1
current-output check, (3) the finalized routing discriminator in `decisions.md`
ADR-2. If the discriminator cannot be made corpus-safe, STOP (ADR-2 consequence).

## Tasks

| id | task | output |
|----|------|--------|
| T0.1 | In `~/git/plantuml`, read `CommandCreateElementFull2.java`, `CommandCreateElementParenthesis.java`, `CommandLinkLollipop.java`, and `CommandCreateEntityObject.java`. Build the table: each `ALL_TYPES` keyword → `LeafType` → `USymbol` → the svek node shape (rect / rectangle-with-icon / ellipse / plaintext-lollipop / circle). Cross-check every shape against the 18 fixtures' cached oracle DOT (Batch-0 inventory in README). | keyword→shape table |
| T0.2 | For each of the 5 Tier-1 `{class}` fixtures (dudimi, duvuti, pareli, taxemo, xodopa): render through the class engine TODAY (force-route or unit-drive `parseClass`+layout), compare structural DOT to the oracle. Which already match? Those flip on routing alone; those that don't get a note on what structural gap remains. | per-fixture: flips-on-routing / gap |
| T0.3 | Finalize ADR-2. Read upstream's factory-selection path (how `PSystemFactory`/the factory list trial-parses and picks class vs description for a conija/xosiza/cacoma block). Confirm the discriminator. Then run it (on paper or a throwaway probe) against the DESCRIPTION corpus fixtures: does it pull ANY currently-EQUAL description fixture into class? If yes, narrow it; if it can't be narrowed, STOP. | ADR-2 Accepted + corpus-safety evidence |
| T0.4 | Confirm `allow_mixing` handling: upstream `CommandAllowMixing` just flips a flag. Our class parser must accept the line as a no-op directive (like other `class-directives.ts` entries). Note the insertion point. | note |

## Exit criterion
The shape table exists and matches the oracle for every element type in the 18;
ADR-2 is Accepted with corpus-safety evidence (or the mission is STOPPED with a
one-paragraph why). Tier-1 fixtures are classified flips-on-routing vs needs-work.

## Anti-pattern to avoid
Guessing a shape because it "should be" rect. Every keyword's shape is read from
upstream and cross-checked against a cached oracle. The desc-routed lesson: the
oracle is the spec; the ledger/brief is not.
