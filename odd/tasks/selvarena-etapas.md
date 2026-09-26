# SELVARENA — Etapas (circuito anual) + ranking por puntos

ODD feature doc. Adds circuit stages (etapas) on top of the current global
single-tournament model, and the annual points ranking.

Branches: work happens on `feat/selvarena-front` (current unified tree that
contains the merged back + visual tweaks). Conventional commits per work unit.
Delivery (push/PR/merge) stays user-owned; no RDD.

Status: **IN PROGRESS** (implementation). Task map: engram topic
`odd/selvarena-etapas/tasks`.

## Scope update (Gabriel, 2026-09-25)

Replaces the public "agenda" entry point: remove the `Ver agenda completa` /
`Ver posiciones finales` link on PublicHome. In its place a combined panel:

- **Left**: general points of the CURRENT circuit (annual ranking: points
  accumulated per pair across ALL etapas, even etapas not yet created — the
  organizer will upload them incrementally).
- **Rest**: list of positions of ALL etapas (per-etapa final position of each
  pair).

Organizer panel gains the "Circuitos y etapas" section: create a new etapa
(teams per circuito). **Once a circuito is finished it becomes immutable**
(no more result/zone edits) — new `closedAt` flag on Etapa.

Decisions confirmed this session:
- Points scale: the official Plantilla (100-80-65-50-40-40-30-25-10-10; 9th+
  floor 10). Per-position scoring accumulated across etapas.
- Final position per etapa: bracket + zone standings (1st/2nd = Gran Final
  winner/loser; 3rd/4th = semifinal losers by pts/dif; 5th+ by position in
  zone standings, best zone leader = 5th; non-bracket teams follow).
- Only etapas with the FINAL decided accumulate points; in-progress etapas
  contribute nothing until closed (documented decision).
- Pair-only ranking for now: the model has no per-player names yet (player
  ranking deferred until Team stores players).

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

- [x] (S1 + S2) Back etapas COMPLETO — commit `51fa319` en feat/selvarena-front:
      schema `Etapa` + `etapaId` en Team/Match/TournamentState (state per-etapa,
      id → cuid, unique etapaId); migración `20260924100000_etapas` con backfill
      de la data actual como "Etapa 5"; `back.ts` scoped (todas las ops resuelven
      la etapa, latest por default), `listEtapas`/`createEtapa` (teams → zonas →
      fixture round-robin + slots de bracket en una transacción), `POST
      /api/etapas` (organizer-only), `?etapa=` en /api/state y /api/zonification;
      `roundRobinPairs` (círculo, bye para nones); seed con Etapa 5 scoped.
      Checks: 116/116 tests, tsc, eslint.
- [x] Visual tweaks front — commit `65f17c0`: marcador arriba de posiciones y
      transparencia de cuadros (bg-white/40 + fondo lavado reducido en layout).
- [x] (R1) Ranking back COMPLETO — commit `018840a` feat/back: `src/lib/ranking.ts`
      (posiciones finales por etapa desde bracket + tabla de zona; escala Plantilla
      100-80-65-50-40-40-30-25-10-10 con piso 10 para 9°+; agregación por pareja
      acumulada en etapas FINAL-decided); `GET /api/ranking` devuelve escala +
      ranking anual + positions por etapa. `package.json` agrega ranking.test.ts.
      Checks: 20 tests ranking, 136/136 total, tsc, lint. Smoke: `/api/ranking` 200
      {scale, ranking[], etapas[Etapa 5 finished:false]}.
- [x] (R2) Inmutabilidad COMPLETO — commit `a16f29c` feat/back: `Etapa.closedAt
      DateTime?` + migración `20260925100000_etapa_closed_at` + client regenerado;
      guard `requireEtapaOpen` en generateZones/swapTeam/confirmZonification/
      recordResult/editResult (409 etapa_cerrada); `POST /api/etapas/:id/close`
      (organizer-only, 409 si ya cerrada o FINAL sin resultado, publica SSE);
      `listEtapas` expone `closedAt` (contrato con el front). Tests de guard en
      back.integration.test.ts. Checks: 136/136, tsc, lint.
- [x] (S3) Public COMPLETO — commit `f12a2b1` feat/front: `lib/front/types.ts`
      agrega `EtapaMeta{...,closedAt}` + `etapaId/etapa/etapas` en snapshot + tipos
      de ranking; `api.ts` agrega fetchRanking/fetchEtapas/closeEtapa/createEtapa;
      PublicHome sin link de agenda renderiza `<RankingPanel/>` (izquierda: ranking
      anual; resto: posiciones por etapa de TODAS; nota de escala al pie; estados
      vacío/en curso). Checks: tsc + build.
- [x] (S4) Organizer COMPLETO — commit `f12a2b1` feat/front: `CircuitosSection.tsx`
      (form crear etapa nombre/fecha/equipos; listado con "Cerrar circuito" cuando
      ranking dice finished && !closedAt, derivado de `/api/ranking` + closedAt de
      listEtapas); OrganizerPanel habilita "Circuitos y etapas" (case "circuitos").
      Checks: tsc + build.
- [ ] (S6) Past etapas (follow-up, no iniciado): la organizadora carga una etapa
      ya cerrada con sus resultados; el ranking la acumula.

## Progress log

- 2026-09-25 W1 (back etapas): commit `51fa319` — ver arriba. Dev server
  re-armado (PID 11812), `/api/etapas` 200, `/api/state` 200 con etapa Etapa 5.
  Quedan SIN commitear (sesión de front paralela, no tocadas por mí):
  layout.tsx, PosicionesSection.tsx, AgendaView.tsx, EliminatoriesView.tsx,
  MatchTicker.tsx, PublicHome.tsx, StandingsTables.tsx.

## Notes

- dev.db slot-1 cleanup already done in the multi-set migration; current dev.db
  holds Etapa 5 seed data (23 matches, all PENDING) — that becomes Etapa 1 in
  the new model with a migration backfill.
- Points scale sourced from `03-Planillas/Plantilla Circuito Mixto
  (mejorada).xlsx` → sheet "Puntos Etapa" + "Equipos" (D:E scale, H4/H5 match
  points, L:N player names). Exact fidelity target.
- The rest of the app (SSE, auth, editing guards) is etapa-agnostic but must
  not break; SSE events stay global for now (one active etapa at a time).