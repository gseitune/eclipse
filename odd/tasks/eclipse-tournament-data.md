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

## Progress

- T1: DONE 2026-09-22 — engine with injectable RNG; verified via TSX assertions (6/7/10/11/12/13/20 teams + 200 real-random runs for 11 → always balanced 4/4/3; <6 throws).
- T2: DONE 2026-09-22 — idempotent seed via `prisma.config.ts` `migrations.seed` (Prisma 7 no longer reads `package.json` `prisma.seed`: "No seed command configured"); `npx prisma db seed` → "Seed OK — 10 teams, 23 matches (20 with fixed pairs, 3 bracket slots)".
- T3: DONE 2026-09-22 — footer shows "10 equipos · 23 partidos cargados"; build passes; dev HTTP 200 with seeded names.
- T4: DONE 2026-09-22 — 4 work-unit commits: `e6d4db5` engine, `92c4b4d` seed, `451b175` home counts, `bacdbfa` docs. Push pending.

## Delivery

Forecast: ~250 authored lines. Strategy: direct commits to `main` (solo repo).