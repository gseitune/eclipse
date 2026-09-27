# Feature: match-manual-times — manual start/end times per match + time estimate

## Objective
Cargar inicio/fin manual opcional por partido (Match) y exponer un helper puro que estime
la finalización del día. Slice chico. NO tocar la página pública del organizador (otro slice).

## Problem / Why
La agenda estima horarios con `computeSchedule`; los organizadores necesitan fijar a mano
el inicio/fin real de un partido y ver la estimación del final de la jornada.

## Scope
- Backend + schema + helper puro + tests + commit. Sin cambios de UI.
- Ramas de trabajo: `feat/selvarena-front` (rama actual).

## Constraints
- No tocar la página pública del organizador.
- Tests de endpoint a nivel route (feasible: `new NextRequest()` funciona bajo `node --test` con tsx).
- Cliente Prisma generado está checked-in: regenerar y commitear tras el schema.
- Migración: `npx prisma migrate dev --name add_match_manual_times`.

## Authorized scope (from user spec)
1. Schema: `Match.manualStartAt DateTime?` y `Match.manualEndAt DateTime?` + migración.
2. `POST /api/matches/[id]/times` (patrón de `src/app/api/etapas/[id]/cancel/route.ts`):
   - sesión organizador; body `{ startAt?, endAt? }` ISO; `null` limpia; 400 `invalid_date`,
     400 `invalid_range` si ambos y endAt <= startAt; 409 etapa cerrada/cancelada;
     update parcial; `publishSse("match-times-changed", { matchId })`.
3. Exponer `manualStartAt`/`manualEndAt` en `ScheduleMatchInput`/`ScheduleRow`
   (`src/lib/schedule.ts`) y en `getScheduleBoard`/`getSchedule` (`src/lib/back.ts`).
   En `computeSchedule`: si el partido tiene horarios manuales, su ventana `scheduled`
   usa ESE horario en vez de la estimación automática.
4. Helper puro NUEVO `src/lib/time-estimate.ts` (sin imports Prisma, sin IIFE, clock
   inyectable): `computeTimeEstimate(input, nowMs, defaultMs)`. Datos de
   `{ manualStartAt?, manualEndAt?, resultStatus }`. `null` si ningún row tiene
   manualStartAt. Devuelve `{ tournamentStart, elapsedMs, remainingMs, estimatedEndAt,
   pendingCount, inProgressCount }` con las reglas del spec del usuario.
5. Tests: endpoint (401/404/400×2/409×2/200 set+clear) + helper con el caso exacto del
   usuario (inicio 13:00, now 18:00, 2 pendientes → elapsed 4:00, remaining 40min,
   end 18:40; en curso hace 10 min → remaining baja; retrasado → estimatedEndAt corre;
   sin manualStartAt → null). Correr TODA la suite + `npm run build`.
   Commit Conventional: `feat(matches): manual start/end times + time estimate`.

## Tasks
- [x] T0 — Setup: doc ODD + espejo engram. (orquestador)
- [x] T1 — Schema + migración + `prisma generate`.
- [x] T2 — Endpoint `POST /api/matches/[id]/times`.
- [x] T3 — Passthrough en schedule.ts/back.ts + override en computeSchedule.
- [x] T4 — Helper puro `time-estimate.ts` + tests.
- [x] T5 — Tests endpoint + suite completa + `npm run build` + commit.

## Acceptance criteria
- `npm test` completo en verde: **190/190 pass** (38 suites; incluye 10 tests de endpoint route).
- `npm run build` OK (ruta `/api/matches/[id]/times` registrada).
- Commit único: **`404fbd7` feat(matches): manual start/end times + time estimate** (14 files, +922/-14).

## Applicable checks
- TDD: OFF (sin config strict TDD en el repo; runner: `node --import tsx --test <archivos>`).
- Verification: `npm test` (script exacto de package.json) + `npm run build`.

## Delivery
- single-pr (un único commit en `feat/selvarena-front`). Sin push (no pedido).

## Progress / Evidence
- 190/190: `npm test` (node --import tsx --test; 38 suites) — 2026-09-26.
- `npm run build`: OK, `/api/matches/[id]/times` en el route map.
- Endpoint tests a nivel route con `new NextRequest()` + SQLite throwaway. NOTA: el archivo de tests del endpoint NO puede vivir bajo `src/app/api/matches/[id]/` porque node --test no descubre paths con `[id]` (glob) — vive en `src/lib/manual-times-route.test.ts` con import relativo al route.
- El writer delegado originalmente sacó 180/190; el orquestador detectó que los tests route no corrían en la suite (0 tests) → movió el archivo + ajustó repoRoot + package.json → 190/190, y squasheó 2 commits → 1.