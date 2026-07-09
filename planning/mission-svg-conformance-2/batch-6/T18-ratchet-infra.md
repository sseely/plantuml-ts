# T18 — Ratchet infra + seed fixtures (D11)

## Context
The regression-proof gate. A fixture ratchets in once conformant; the
test then holds it forever. Eligibility is DOT-EQUAL-first: only
fixtures whose DOT the parity report marks EQUAL (topology/geometry
agree → SVG diffs mean emission).

## Task
1. `oracle/goldens/svg-description/ratchet.json`:
   `{ fixtures: Array<{ slug, type, addedAt, source: 'dot-cache' }> }` —
   plus a `README.md` documenting add/remove rules (add = conformant +
   DOT-EQUAL; remove = maintainer-only).
2. Per locked fixture: `oracle/goldens/svg-description/<type>/<slug>/golden.svg`
   — copied from `test-results/dot-cache/<type>/<slug>/in.svg` (the
   committed copy is the gate's truth; dot-cache is regenerable).
3. `tests/oracle/svg-conformance/description.golden.ratchet.test.ts`:
   for each manifest entry, render from the fixture source and assert
   `compareSvg(ours, golden, 'deterministic').pass` with failure
   messages naming slug + first diff path. Model manifest handling on
   `tests/oracle/description-parity.ratchet.test.ts` (the DOT ratchet).
4. Seed: from T17's survey output, select every already-conformant
   DOT-EQUAL fixture (expected: the simple end of the corpus) —
   minimum bar: at least one fixture per ported symbol family that has
   corpus representation, and at least one package/cluster and one
   multi-edge fixture. If a family has corpus fixtures but none
   conformant, that's a finding for T19, journal it.

## Write-set
- `oracle/goldens/svg-description/**` (manifest, README, goldens)
- `tests/oracle/svg-conformance/description.golden.ratchet.test.ts`

## Read-set
- `tests/oracle/svg-conformance/parity.json` (T15/T17 output)
- `tests/oracle/description-parity.ratchet.test.ts` (precedent)
- `../decisions.md#d11`

## Acceptance criteria
1. Given the seeded manifest, when `npm test` runs, then every locked
   fixture passes conformance.
2. Given a deliberately tampered golden (in-test mutation), then the
   failure names slug + first diff path.
3. Given a fixture whose DOT is not EQUAL, then attempting to add it is
   rejected by the test (eligibility enforced in the suite, not just
   documented).

## Observability / Rollback
The ratchet IS the gate. / Reversible.

## Quality bar
Standard gates green; journal the seed count + family coverage table.

## Commit
`test(T18): svg-description conformance ratchet + seed fixtures`
