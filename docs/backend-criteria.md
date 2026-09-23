# SELVARENA Backend Criteria

Reference for the organizer (and the front): how results, standings, schedule
and brackets behave. Back feature doc: `odd/tasks/eclipse-backend-core.md`.

## Results (the only input)

- A result is recorded once per match. Re-recording returns `409`.
- **Complete score**: both `setAScore` and `setBScore` (positive, no ties).
  Winner is derived from the score; passing a conflicting `winnerId` returns `400`.
- **WINNER_ONLY**: no sets, only an explicit `winnerId` that must be one of the
  two teams. Never a partial score.
- Missing both score and winner returns `400`.

## Standings & tiebreak

Per zone, sorted by:

1. **More wins** (games won).
2. **Set difference**, computed from complete-score matches only.
   WINNER_ONLY matches never invent sets (they contribute wins only).
3. **Head-to-head**: counts only among tied teams.
4. **Unresolved** — if the second position (or any position the brackets need)
   is still tied after H2H, the bracket generation **blocks** (`brackets-blocked`)
   and the organizer decides (draw). The backend never fabricates a metric.

## Schedule

- `scheduled`: the fixture base time (from the seed `timeLabel`).
- `estimated`: computed after results; next match starts at the previous
  result's `recordedAt` + prep minutes (default 5, in TournamentState), and each
  later match starts at the previous estimated end (`matchMinutes`, default 20).
- The first pending match of the day sequence is the derived "in progress" match.

## Brackets & phases

- Phase starts at `GROUPS`. The last group result triggers position computation
  and bracket generation; phase moves to `ELIMINATORIES`.
- 2 zones: SF1 = A1 × B2, SF2 = B1 × A2, FINAL.
- 3 zones: SF1 = A1 × best second, SF2 = B1 × C1, FINAL.
- FINAL teams are filled when the semifinals return results (bracket slots hold
  no teams before that).

## Zones

- `generate` (re-)randomizes every team into balanced zones (6–10 → 2 zones,
  more → 3 zones).
- `swap` moves a team between zones **only before fixture confirmation**
  (`zoneConfirmed`); after confirmation it returns `409`.
- `confirm` marks the point of no return; it is required before recording or
  bracket work.

## Auth

- `POST /api/auth/login` sets an HTTP-only signed cookie (HMAC, `AUTH_SECRET`).
  Every device keeps its own cookie: no cross-invalidation.
- `POST /api/auth/logout` clears it.
- Organizer account is created with
  `npx tsx scripts/create-organizer.ts <email> <password>` (no public signup).
- `AUTH_SECRET` is required in production; outside production it falls back to
  a dev-only value (set it before deploying).