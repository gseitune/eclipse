# Feature: selvarena-front

Public home (live dashboard) + organizer panel (Andi) — FRONT ONLY.

## Objective
Ship the SELVARENA public live dashboard (single-screen, mobile-first) and the
organizer panel (Andi) consuming ONLY what the backend exposes via `/api/*`
and the `/api/events` SSE stream. No business logic: never derive standings,
never invent scores, never mutate without an authorized endpoint.

## Problem / Why
The back is closed (commit `224dc4e`, tiebreak patch `e6fa1b2`). The current
home (`src/app/page.tsx`) reads Prisma directly and is a static list — it has
no live updates, no positions tables, no elimination mode, and no organizer
panel. The spec (2026-09-23) defines the product surface.

## Scope (authorized 2026-09-23, decision "solo lo consumible")
- Public home: compact hero, zone standings as position tables (mobile tabs
  A/B/C, desktop 3 columns), team sheet (bottom sheet / floating panel), match
  ticker (previous / live / next), agenda behind a link, automatic
  ELIMINATORIES switch via SSE, DESEMPATE as a regular ticker match + bracket
  that waits, defensive unknown-phase rendering, real-time via SSE.
- Organizer panel at `/organizador`: login/logout (same cookie session,
  multi-device), quick result entry (mobile 3-tap: full score OR winnerId),
  notebook checklist ("faltan N partidos"), result editing where the back
  supports it, zonification flow (arm -> review/adjust -> confirm, guard 409),
  live standings, CHIME v1 (Web Audio + banner + "El partido sigue" snooze 5m).
- Sections the back does NOT expose (team CRUD + status inscripto/activo/
  ausente, circuito/etapa create/edit/duplicate/history, reschedule matches)
  render as DISABLED placeholders with "próximamente" — no mock data, no
  invented endpoints.
- OUT (v2): Web Push, PWA, email reminder, business logic.

## Constraints
- `SOLO FRONT`: consume the closed API contract. Never import `src/lib/back.ts`
  from client code; the browser calls the HTTP routes.
- Mobile-first responsive; existing SELVARENA aesthetic (jungle/sun/brand,
  sand/amber/emerald palette, Tailwind 4 theme tokens in globals.css).
- Defensive phases: enum Phase may grow (DESEMPATE already real). Unknown
  phase -> generic state, never crash.
- Never invent a score: "solo ganador" renders "Ganó X", not "X - 0".
- Next.js 16 rules: async request APIs only (`await cookies()` etc.),
  Turbopack default, no `next lint` (use `npm run lint` = eslint).
- Working tree has unrelated uncommitted files (`src/generated/prisma/*`,
  `public/sun.jpg`) — NEVER stage or commit them.

## Checklist (stable IDs)
- [x] T1 — Front contract types + typed API client + defensive phase helpers
      (`src/lib/front/types.ts`, `src/lib/front/api.ts`, `src/lib/front/phase.ts`,
      `phase.test.ts`; package.json test script extended). Checks: tests 54/54,
      tsc clean, eslint clean.
- [x] T2 — Live state hook: fetch /api/state + EventSource /api/events with
      reconnect + heartbeat check (`src/lib/front/use-live-state.ts`)
- [x] T3 — Root layout (lang es, metadata) + public home shell (server fetch
      /api/state, hero compacto, discreet "Organizador" link)
- [ ] T4 — Standings position tables: mobile tabs A/B/C (auto-open zone with
      live match), desktop 3 columns
- [ ] T5 — Team sheet: mobile bottom sheet, desktop floating panel (played,
      results, times for that team)
- [ ] T6 — Match ticker: previous (result) / live / next (time + prep);
      WINNER_ONLY -> "Ganó X"; day edges -> clean empty state
- [ ] T7 — Full agenda behind "Ver agenda completa" link
- [ ] T8 — ELIMINATORIES mode: centered brackets (semis + final) replacing
      zones+ticker, classified banner, final-position team sheet, "VER
      POSICIONES FINALES" link; DESEMPATE in ticker + bracket waits;
      unknown phase -> generic state
- [ ] T9 — /organizador: login/logout (cookie session, multi-device), page
      gate reads session server-side
- [ ] T10 — Organizer panel shell + disabled placeholders (teams, stages,
      reschedule -> "próximamente")
- [ ] T11 — Mobile quick result entry (3 taps) + notebook checklist ("faltan
      N partidos") + result editing via POST /api/results
- [ ] T12 — Zonification flow: arm (generate) -> review/adjust (swap with
      guard) -> confirm -> fixture; 409 handled as disabled + notice
- [ ] T13 — CHIME v1: Web Audio (no permissions), banner "Cargá el resultado",
      "El partido sigue" snooze 5 min
- [ ] T14 — Panel live standings + final verification: lint, build, tests,
      manual mobile/desktop pass

## Authorized scope / acceptance criteria
- Home (mobile): 1 screen, max 1-2 scrolls; opens live results by default.
- Eliminatorias auto-switch fires on SSE phase change; brackets fill
  themselves from /api/state.
- Panel: results flow works notebook + iPhone; zonification works with
  409-guard messaging; CHIME triggers when live match exceeds its estimated
  end time without a result.
- No business logic invented; disabled placeholders are visibly disabled.

## Applicable checks (per milestone)
- `npm run lint`
- `npm run build`
- `npm test` (existing back core tests must keep passing)

## Progress / evidence
- TDD mode: off (no project TDD config; functional checks above).
- Forecast ~1300+ authored changed lines (front is large) -> delivery
  strategy: ask-on-risk -> resolved to **feature-branch-chain** (2026-09-23).
  Tracker branch: `feat/selvarena-front` (draft/no-merge until all slices
  merge). Child PR #1 targets the tracker branch; later children target the
  immediate parent branch.

## Slice boundaries (feature-branch-chain)
- Slice 1 (PR -> tracker): T1-T3 — contract types, API client, live-state
  hook, layout + home shell
- Slice 2 (PR -> PR1): T4-T5 — standings tables + team sheet
- Slice 3 (PR -> PR2): T6-T7 — match ticker + agenda link
- Slice 4 (PR -> PR3): T8 — eliminatorias mode (desempate, defensive phase)
- Slice 5 (PR -> PR4): T9-T10 — /organizador login+logout, panel shell +
  disabled placeholders
- Slice 6 (PR -> PR5): T11-T12 — quick result entry + checklist + zonification
- Slice 7 (PR -> PR6): T13-T14 — CHIME v1 + panel live standings + final
  verification

## Progress / evidence
- T1 done — commit `4318f29` feat(front): API contract types, typed client,
  phase helpers. Checks: `node --import tsx --test src/lib/front/phase.test.ts`
  13/13, full `npm test` 54/54, `npx tsc --noEmit` clean, eslint clean.
  RDD: off (not enabled by user) — no native review for this commit.
- T2 done — commit `d8431d2` feat(front): live-state SSE hook. Checks: tsc
  clean, eslint clean, existing tests still 13/13. RDD: off, no review.
- T3 done — commit `6d718e1` feat(front): public home shell, compact hero,
  es layout. Checks: tsc clean, eslint clean (1 pre-existing warning
  pairKey in standings.ts, not ours), tests 13/13. RDD: off.
- Next: T4.

## Next step
T1.