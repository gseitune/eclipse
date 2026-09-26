# SELVARENA — Etapas (circuito anual) + ranking por puntos

ODD feature doc. Adds circuit stages (etapas) on top of the current global
single-tournament model, and the annual points ranking.

Branches: work happens on `feat/selvarena-front` (current unified tree that
contains the merged back + visual tweaks). Conventional commits per work unit.
Delivery (push/PR/merge) stays user-owned; no RDD.

Status: **IN PROGRESS** (implementation). Task map: engram topic
`odd/selvarena-etapas/tasks`.

---

## Objective

Andi runs an ANNUAL circuit: each "etapa" is a one-day tournament (sat or
sun) with its own teams, zones and matches. Requirements (Gabriel, 2026-09-24):

1. **Organizer creates/loads a new etapa** from the front; etapas are saved in
   the back and **all of them are viewable from the public page** (selector).
2. **Annual ranking of pairs (parejas) and best individual players** by points,
   accumulated across etapas.
3. **Load results from PAST etapas** so the annual data exists even for
   historical stages.
4. Points scale (from the official Plantilla `Puntos Etapa` sheet, copied from
   the Etapa 5 brief):
   - Position points per player: 1st=100, 2nd=80, 3rd=65, 4th=50, 5th=40,
     6th=40, 7th=30, 8th=25, 9th=10, 10th=10.
   - Match points (group tiebreak + "Puesto base"): 2 per victory, 1 per loss.
   - Official order: 1st/2nd = Gran Final winner/loser, 3rd/4th = semifinal
     losers (pts/dif), 5th+ by pts/dif.
   - Each player of a pair earns the pair's position points.

## Approved scope

Authorized implementation (Gabriel: "Armame eso"). Follow-up features in the
SAME feature: annual ranking (pair + player) and past-etapa result loading.
Work-unit commits; no PRs/push.

## Architecture decisions (agreed)

- **Etapa model** `Etapa { id, name, date?, order, ... }`; `Team`, `Match` and
  `TournamentState` all gain `etapaId` (FK). All back services scope queries
  by etapa. TournamentState becomes per-etapa (one row per etapa, keyed by
  unique `etapaId`), no longer the id=1 singleton.
- **Etapa creation** is organizer-authorized; creating an etapa with a team
  list generates zones (existing `distributeTeams`) and the group round-robin
  matches (NEW pure generator in tournament.ts, circle method, single court,
  sequential slots like the seed) + bracket slots (SEMIFINAL_1/2, FINAL).
- **Public flow**: `GET /api/state?etapa=<id|latest>` returns the etapa
  snapshot + the etapa list; PublicHome renders a selector; section data
  belongs to the selected etapa.
- **Ranking (next slice)**: `GET /api/ranking` aggregates position points per
  pair and per individual player across etapas (points scale constant), fit
  from player names ("Jugador 1"/"Jugador 2" per team) — the Plantilla stores
  player names per team.
- **Past etapas (next slice)**: organizer registers a past etapa with its
  results (full match entry) and the ranking accumulates automatically.

## Forecast

- S1 schema+migration+seed: Etapa + etapaId on Team/Match/TournamentState;
  existing Etapa 5 data becomes the first etapa. ≈ 150 authored.
- S2 back: scoped services + `GET/POST /api/etapas` + `?etapa=` on state +
  round-robin generator + tests. ≈ 320 authored.
- S3 public: selector + etapa-aware snapshot types/consumer. ≈ 120 authored.
- S4 organizer: "Circuitos y etapas" section (create + switch) + section
  wiring to active etapa. ≈ 180 authored.
- S5 ranking API + annual view (pair & player). ≈ 250 authored.
- S6 past-etapa results loading. ≈ 180 authored.
- Total forecast ≈ 1200 authored (disclosed; delivered in work-unit commits,
  no delivery gate applies). Checks: `npm test`, `npx tsc --noEmit`, lint
  after each unit.

## Checklist

- [ ] (S1) `prisma/schema.prisma`: `Etapa` model; `etapaId` on Team/Match/
      TournamentState (TournamentState per-etapa with unique etapaId);
      migration (hand-written: add tables, backfill `Etapa 5` + etapaId on
      existing rows); `prisma generate`; seed attaches etapaId. Checks: tsc.
- [ ] (S2) Back scoping: `getState(etapaId)`, `getStandings(etapaId)`,
      `getSchedule(etapaId)`, `getBracketsSnapshot(etapaId)`, `getNextMatch`,
      `getTeamsByZone`, `generateZones`, `swapTeam`, `confirmZonification`,
      `recordResult`, `editResult`, desempate/bracket machinery — all scoped.
      Etapa create service (auth-guarded route `POST /api/etapas`) creates
      etapa + teams + round-robin group matches + bracket slots.
      Round-robin generator in tournament.ts (circle method) with zone split
      and single-court sequential slots. State route accepts `?etapa=` and
      includes `etapas` list. Tests: tournament round-robin + etapas service.
- [ ] (S3) Public: `page.tsx` passes `etapas` + selected; PublicHome selector
      (client-driven refetch); `lib/front/types.ts` adds `EtapaMeta` +
      `etapaId` in snapshot. Checks: tsc + build.
- [ ] (S4) Organizer: enable "Circuitos y etapas" section — create form
      (name, date, team names textarea) and etapa switch; Resultados/
      Zonificación/Posiciones bound to active etapa. Checks: tsc + build.
- [ ] (S5) Ranking: `src/lib/ranking.ts` (positions → position points; pair +
      per-player aggregation across etapas; scale constant from Plantilla);
      `GET /api/ranking`; public "Ranking anual" view. Checks: tests.
- [ ] (S6) Past etapas: organizer creates a closed etapa and enters past
      stage results (match-by-match, same payload validation); ranking
      reflects them. Checks: tests.

## Notes

- dev.db slot-1 cleanup already done in the multi-set migration; current dev.db
  holds Etapa 5 seed data (23 matches, all PENDING) — that becomes Etapa 1 in
  the new model with a migration backfill.
- Points scale sourced from `03-Planillas/Plantilla Circuito Mixto
  (mejorada).xlsx` → sheet "Puntos Etapa" + "Equipos" (D:E scale, H4/H5 match
  points, L:N player names). Exact fidelity target.
- The rest of the app (SSE, auth, editing guards) is etapa-agnostic but must
  not break; SSE events stay global for now (one active etapa at a time).