# Feature: eclipse-tournament-data

**Objective**: Seed the Etapa 5 tournament (10 teams, 23 matches) from the brief, plus a small pure tournament engine that encodes Gabriel's group rules: minimum 6 teams; 6–10 teams → 2 zones; more than 10 → 3 zones; when the split is uneven, ONE random zone takes ALL extra teams.

**Why**: Gabriel specified the rules to build the data "this way" — group distribution must be dynamic, not hard-coded to 10 teams. Etapa 5 remains the reference instance (2 zones of 5).

**Scope**: pure engine module + idempotent seed script + home page footer shows loaded matches. No team-registration UI, no 3-zone playoff structure yet (open decision when >10 teams actually happen), no result entry.

**Constraints**:
- Fixture canonical data = brief CSV (fixed pairs + 20-min slots, single court, 10:00–17:40). The seed uses the brief schedule; the engine is NOT used to generate Etapa 5's schedule.
- Result-quality rule does not apply to seeds (no results seeded; all matches `PENDING`).
- Zones for Etapa 5 teams are fixed by the brief (A/B). `distributeTeams` is for future registration flow; seed stays canonical.
- Interpretation of the uneven rule (explicit, user-corrected): sizes are BALANCED, max difference 1 (11 teams / 3 zones → 4/4/3; 13 → 5/4/4). Randomness only decides WHICH zone(s) carry the extra(s).
- TDD mode: unknown → ordinary functional checks (seed run, distribution assertions, build, dev HTTP).

**Checks**:
- `npx prisma db seed` applies idempotently (10 teams / 23 matches)
- Distribution assertions pass for 6, 7, 10, 11, 12, 13 teams (min 6 throws below)
- `npm run build` passes; dev server serves seeded home

## Checklist

- [ ] T1: Engine `src/lib/tournament.ts` — `MIN_TEAMS`, `groupCountFor`, `distributeTeams` with injectable RNG; verified by TSX assertions
- [ ] T2: Seed `prisma/seed.ts` — 10 teams + 23 matches (stage/timeLabel/slot); `tsx` installed; `prisma.seed` config; `npx prisma db seed` runs clean
- [ ] T3: Home footer shows team + match counts; build + dev boot OK
- [ ] T4: Work-unit commits + push to `origin/main`
- [ ] T5: Align schema Zone enum with engine — add `C` to `Zone` in `prisma/schema.prisma`, regenerate client, migrate if needed (SQLite stores TEXT; enum validation is app-level). Seed stays A/B (brief-canonical).
- [ ] T6: Persistent test suite for the engine — `src/lib/tournament.test.ts` on `node:test` via `tsx` (zero new deps); cover: <6 throws, group counts at 6/10/11, balanced sizes (max diff 1) at 11/12/13, zone order preserved, injectable RNG determinism. `npm test` script.

## Progress

- T1: DONE 2026-09-22 — engine with injectable RNG; verified via TSX assertions (6/7/10/11/12/13/20 teams + 200 real-random runs for 11 → always balanced 4/4/3; <6 throws).
- T2: DONE 2026-09-22 — idempotent seed via `prisma.config.ts` `migrations.seed` (Prisma 7 no longer reads `package.json` `prisma.seed`: "No seed command configured"); `npx prisma db seed` → "Seed OK — 10 teams, 23 matches (20 with fixed pairs, 3 bracket slots)".
- T3: DONE 2026-09-22 — footer shows "10 equipos · 23 partidos cargados"; build passes; dev HTTP 200 with seeded names.
- T4: DONE 2026-09-22 — 4 work-unit commits: `e6d4db5` engine, `92c4b4d` seed, `451b175` home counts, `bacdbfa` docs. Push pending.
- T5/T6: added 2026-09-23 — Gabriel asked to "leave the logic side prepared" for future changes; scope confirmed: align schema+logic and add tests (6/10/11/13 edge cases). 3-zone playoff structure remains an open product decision (not in scope).
- T5: DONE 2026-09-23 — `Zone` enum now A/B/C in `prisma/schema.prisma`; client regenerated. `migrate dev` reported "already in sync" (SQLite stores TEXT — no SQL-level CHECK constraint, enum is app-level). Seed unchanged and still A/B (brief-canonical).
- T6: DONE 2026-09-23 — `src/lib/tournament.test.ts` on `node:test` via tsx (`npm test`): 12 tests pass — <6 throws, group counts at 6/10/11, balanced sizes (max diff 1) at 11/12/13, 50×random balance sweep for 6–20 teams, order/membership preserved, RNG-injection determinism. Also fixed `no-unused-vars` lint warning in `distributeTeams` (use `group.teams` instead of `groups[index].teams`). Build + lint + seed all green.

## Delivery

Forecast: ~250 authored lines. Strategy: direct commits to `main` (solo repo).