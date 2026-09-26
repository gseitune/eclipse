# SELVARENA — Reagendar partidos (orden del día)

ODD feature doc. Activates the "Reagendar partidos" section in the organizer
panel: shows the order of matches for the day and lets the organizer move a
pending match earlier/later (swap slots with the nearest pending neighbor).

Branches: work on `feat/selvarena-front`. Conventional commits per work unit.
Delivery (push/PR/merge) stays user-owned; no RDD.
Status: **IN PROGRESS**. Task map: engram topic `odd/reagendar-partidos/tasks`.

## Scope (Gabriel, 2026-09-26)

- Backend: `reorderMatch` (swap slots between a PENDING match and the nearest
  PENDING neighbor up/down; refuse played matches; SSE `schedule-changed`).
- API: `GET /api/schedule` (day board with teams) + `POST /api/schedule/reorder`
  (organizer-only).
- Front: new `ReagendarSection` listing the day's matches in slot order with
  up/down arrows for PENDING matches; enable the panel card.

## Decisions

- Only PENDING matches can be moved; played matches stay anchored to their real
  position in the day (moving them would rewrite history).
- "Up/down" swaps with the nearest PENDING neighbor in that direction; a move
  with no neighbor in that direction is refused with 409.
- The day board reuses `computeSchedule` (scheduled/estimated windows) and adds
  team names; `ScheduleRow` alone has no teams, so a dedicated board type is
  used instead of overloading the public snapshot.

## Tasks

- [ ] T1. Backend `getScheduleBoard` + `reorderMatch` in `src/lib/back.ts`
- [ ] T2. Routes `GET /api/schedule` + `POST /api/schedule/reorder`
- [ ] T3. Front api client: `fetchScheduleBoard` + `rescheduleMatch`; types
- [ ] T4. `ReagendarSection.tsx` (day order list, up/down arrows, error handling)
- [ ] T5. Enable card in `OrganizerPanel.tsx` + routing
- [ ] T6. Integration tests for reorder guards; tsc/lint/test green