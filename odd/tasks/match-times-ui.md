# Match times UI + reactive day counters

- **Objective**: Front-only slice — button to load start/end per match (organizer panel) + always-visible counters card with reactive estimate.
- **Problem**: Organizer loads results but cannot tell players when matches start/end; no day-level overview.
- **Why**: Manual times already exist in the back (POST /api/matches/:id/times, manualStartAt/manualEndAt in state.schedule); the UI is missing.
- **Scope**: Client UI only. Back is applied and verified — do NOT touch src/lib/back.ts, src/lib/schedule.ts, src/app/api, src/lib/time-estimate.ts.
- **Constraints**: AGENTS.md (Next rules already respected — all patterns reused from panel). Reuse existing modal/card styles (CircuitosSection overlay, ResultadosSection card).
- **Data facts** (verified in code):
  - state.schedule rows carry `manualStartAt`/`manualEndAt` (ISO) — types.ts ScheduleRow needs the fields added.
  - state.schedule does NOT carry `resultStatus`; cross by id from state.brackets (MatchPublic.resultStatus).
  - POST /api/matches/:id/times accepts partial `{ startAt?, endAt? }` (ISO or null), errors: 401, 400 invalid_date/invalid_range, 404, 409 etapa_cerrada/etapa_cancelled.

## Tasks

- [x] T1: api.ts — add `setMatchTimes(matchId, { startAt?, endAt? })` helper (POST, credentials same-origin).
- [x] T2: types.ts — extend ScheduleRow with `manualStartAt?: string | null; manualEndAt?: string | null`.
- [x] T3: ResultadosSection — time button next to match label; modal (Inicio/Fin datetime-local + "Ahora mismo", Guardar/Quitar/Volver, back errors visible, disabled while sending); on success close + refetch + show local range "15:30 – 15:50".
- [x] T4: OrganizerPanel — counters card always visible in panel view; computeTimeEstimate(schedule rows + resultStatus from brackets, now, matchMinutes * 60_000); setInterval 30s; null → "Sin horario definido — cargá el horario del primer partido".
- [x] T5: Gate — tsc + eslint clean; WINNER_ONLY helper bug reported with evidence (not fixed, back-owned).

## Verification evidence

- [x] GET /api/state live: schedule rows carry manualStartAt/manualEndAt (null when unset); resultStatus NOT present in schedule rows (join from brackets confirmed necessary).
- [x] tsc --noEmit == 0; eslint on changed files == 0.
- [x] npm test: 190/190 pass.
- [x] POST /api/matches/:id/times returns 401 without session (route alive, auth guard correct).
- [x] Helper bug with WINNER_ONLY reproduced numerically: remainingMs 9,000,000 (150 min) vs 5,400,000 (90 min) with the suggested fix — a played WINNER_ONLY match adds ghost minutes.
- [ ] Browser click-through with organizer session (user-owned).