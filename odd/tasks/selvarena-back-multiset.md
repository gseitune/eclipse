# SELVARENA back — multi-set results (ADDENDUM #1)

ODD feature doc tracking the SELVARENA back patch that migrates results to a
multi-set model with win-by-2 validation trends.

Branches: `feat/selvarena-front` (OWNED, untouched here) and
`feat/selvarena-back` (owned by this task, base = main). Back work is
committed ONLY on `feat/selvarena-back` with conventional commits.

Status: **IN PROGRESS** (implementation).

Task map: engram topic `odd/selvarena-back-multiset/tasks`.

---

## Objective

Let the organizer edit a mis-recorded result (already shipping in the PATCH,
commit `7dadce3`) and, per the Andi-defined format set, record multi-set
results with real win-by-2 validation:

- **Groups** (and the best-second DESEMPATE): single set to 21 (`SINGLE_21`).
- **Semifinals**: organizer picks at load time → `SINGLE_21` (1x21) or
  `TWO_15_TIEBREAK` (2x15; on 1-1 the third set to 15 is REQUIRED).
- **FINAL**: `BEST_OF_3_21` (best of 3, first to 2 sets wins; tope 21; no
  set 4 — the payload cuts once a team reaches 2 sets).
- **WINNER_ONLY** stays allowed in every stage (never invent scores). Winner
  is ALWAYS derived from complete sets; a `winnerId` in the payload must agree
  with the sets (400 on mismatch). Legacy `setAScore/setBScore` columns are
  dropped; standings read `sets[]` as sets-won counts (already the semantics
  today — groups single-set make it identical).

### Validation (win-by-2)

A set is valid when `high >= cap && high - low >= 2`. Cap by format:
`SINGLE_21`→21, `TWO_15_TIEBREAK`→15(3rd set also 15), `BEST_OF_3_21`→21.
So `15-14` and `21-20` are INVALID (400 with reason), `16-14`/`22-20` valid.

Set-count by format (400 with reason):
- `SINGLE_21`: exactly 1 set.
- `TWO_15_TIEBREAK`: 2 sets (2-0 sweep) OR 3 sets (2-1). A 2-set payload
  that is 1-1 is INVALID (400 `third_set_required`). Sweep may never include
  a spurious set 3.
- `BEST_OF_3_21` (FINAL): 2 sets (2-0) OR 3 sets (2-1). Never 1 set, never
  4. Cuts at 2 sets — a payload that continues after a 2-set sweep is 400.

Winner derivation: team with the most sets won. `WINNER_ONLY`: `sets=null`,
`setFormat=null`, `winnerId` required (from the two teams).

### Stage → format map (400 when violated)

| Stage | Allowed setFormat |
| --- | --- |
| GROUPS | SINGLE_21 |
| DESEMPATE | SINGLE_21 |
| SEMIFINAL_1 / SEMIFINAL_2 | SINGLE_21 or TWO_15_TIEBREAK |
| FINAL | BEST_OF_3_21 only |

`setFormat` may be omitted per-match (org picks at load time), defaulting to
the stage format. `WINNER_ONLY` allowed in any stage.

## Approved scope (automatic, no PRs)

Authorized implementation. Delivery stays user-owned: local branch commits
under ordinary repo policy; no PRs, no push, no review artifacts. The change
is split into two logical work-unit commits (C1 pure validation module;
C2 schema + consumers + integration). The seed/migration and dev.db slot-1
cleanup artifact remain dev-side, documented.

## Forecast

- **Authored (approx, additive deltas, generated excluded):**
  - C1 result-format.ts + result-format.test.ts ≈ 250
  - C2 back.ts, standings.test.ts (+1 vs), schedule.ts/+test, routes, seed,
    integration test, backend-criteria.md, schema+migration, package.json ≈ 360
- **Total forecast ≈ 610 authored** (above the 400 forecast — disclosed).
- **Changed-lines split**: C1 ≈ 250; C2 ≈ 460 (including migration+generated
  client which are largely mechanical). C2 crosses the 400 review-workload
  line; because there are no PRs in this workflow, the guard's delivery
  strategy (size:exception / chained PRs) does not apply. Flagged honestly.
- **Checks**: `npm test` (56 existing + new), `npx tsc --noEmit`, lint; run
  after each unit. Docs + seed + generated are mirror/docs, not counted.

## Risk & delivery

- **Known data risk**: schema migration DROPs `setAScore/setBScore` columns
  and cleans the dev.db slot-1 artifact (`Lu y Gus 2-1 Alex y Flor`, invalid
  under win-by-2) — allowed as dev-side cleanup; the seed doc prepared it.
  Applied within migration for dev.db; no data is inventable/rewriteable.
- **Strict TDD**: not configured (no project flag) → ODD default; tests are
  written alongside and run per unit dashboards; no RED-first gate.
- **No PR/chain**: delivery is user-owned; a merge-size >400 is disclosed but
  strategy is NOT asked (no PRs). If a PR/slice is ever requested, the
  chained-pR strategy to default to `ask-on-risk` and split C2.
- **SSE / events / auth**: unchanged.

## Checklist

- [x] (C1) New pure module `src/lib/result-format.ts` (types + `validateSets`
      + `deriveWinnerFromSets` + `resolveResultPayload`) + tests
      `src/lib/result-format.test.ts`. Run: result-format tests + tsc + lint.
      Commit: `7cf338a` `feat(back): multi-set result validation module
      (win-by-2, per-stage formats)` — 6 files, +685/−6.
- [x] (C2) `prisma/schema.prisma`: `Match.sets` (Json? / SetScore[]),
      `Match.setFormat` (SetFormat?), drop `setAScore/setBScore`;
      migration + regenerate; run `npm test`, `npx tsc --noEmit`, lint.
- [x] (C2) `src/lib/back.ts`: `RecordResultInput`/`EditResultInput` →
      `{ setFormat, sets, winnerId }`; `recordResult`/`editResult` resolve +
      persist `sets[]`/`setFormat`, derive winner; `recordedAt` stamped on
      edit; standings mapping reads `sets[]` as set-won counts; payload shape
      moved to `resolveResultPayload` (single source shared by record+edit).
- [x] (C2) `src/app/api/results/route.ts` + `[id]/route.ts`: parse new payload,
      same guards (405/409), `reason` passthrough preserved; drop old fields.
- [x] (C2) `src/lib/schedule.ts`: `ScheduleRow.editable` already merged;
      `schedule.test.ts` multi-set rows. `src/lib/standings.ts`: mapping
      rename (reads `sets[]`); `standings.test.ts` updated.
- [x] (C2) `src/lib/back.integration.test.ts`: record/edit multi-set cases,
      win-by-2 400s, winner-mismatch 400, descendant guard keeps blocking.
- [ ] (C2) `src/lib/schedule.test.ts` guard tests (already in C1/C0 patch).
- [ ] (C2) `docs/backend-criteria.md` — Results/Standings/schedule sections
      on the multi-set model + editable flag; commit `docs(back): ...`.
- [ ] Final: `npm test` green (56 + new), tsc clean, lint clean; report hash
      + remaining WIP; restore branch state exactly as front/back continued.

## Progress log

### C2 (commit pending) — schema + consumers + integration

- `prisma/schema.prisma`: enum `SetFormat { SINGLE_21 TWO_15_TIEBREAK BEST_OF_3_21 }`; `Match.sets Json?`, `Match.setFormat SetFormat?`; dropped `setAScore`/`setBScore`.
- Migration `20260923215000_multi_set_results` (RedefineTables, no indexes): written by hand via `prisma migrate diff` (interactive `migrate dev` not usable), applied with `migrate deploy`; regenerated Prisma Client 7.10.0 under `src/generated/prisma`.
- dev.db slot-1 artifact cleanup inside migration (UPDATE → PENDING); verified via check script: 23 matches all PENDING, sets=null, fmt=null.
- `prisma/seed.ts`: GROUPS matches get `setFormat: SINGLE_21`; semis/final keep null (organizer picks).
- `src/lib/back.ts`: record+edit persist `sets`/`setFormat`/`resultStatus`/`winnerId`/`recordedAt`; sets written via `Prisma.DbNull` when null and cast at write boundary (Prisma TS index-signature limitation with `InputJsonValue`).
- `schedule.test.ts` passthrough multi-set row; `standings.test.ts` +multi-set count; integration test rewritten (11 cases).
- Checks: npm test 90/90, tsc clean, lint clean (final pass after cast fix).

## Notes

- ACCEPTED: standings setDiff guards margin (standings.test.ts 9→10) changed
  as part of C2 to cover the new fixture shape.
- Folder convention: odd/tasks + engram mirror `odd/selvarena-back-multiset/tasks`;
  captured via mem_save with capture_prompt=false? → doc mirror saved as
  observation (automated artifact, not a prompt capture).
