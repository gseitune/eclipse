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
2. **Head-to-head**: within a zone, the winner of the direct match ranks
   above. Works with any decided match — WINNER_ONLY is enough (uses
   `winnerId`, no scoreboard needed) or a complete score.
3. **Set difference**, computed from complete-score matches only.
   WINNER_ONLY matches never invent sets (they contribute wins only).
4. **Deterministic draw**: if no metric separates the tied teams (including
   the guard "they never faced each other", which should not happen in a
   round-robin), order by name ascending, then id. Never fabricates a metric.

Zone ties therefore always resolve into positions. The only tie case the
system refuses to resolve silently is the cross-zone best-second fight
(below).

## Best second & DESEMPATE (3-zone format only)

- Cross-zone seconds never faced each other: head-to-head does NOT apply.
  Comparison is (wins, set difference).
- **Unique best** → qualifies directly, brackets build immediately.
- **Exactly two seconds tied** → a `DESEMPATE` match is created between them
  for the qualifying spot. It is a regular Match: it enters the schedule
  estimate chain (no base fixture time; estimated only), Andi loads it with
  the normal result flow, and it fires the same SSE events (result + phase).
  The bracket generation WAITS for its result.
- **3+ seconds tied for the spot** → detected and reported WITHOUT breaking
  the flow: `/api/state` exposes `bracketsBlocked` with the tied team ids,
  and an SSE `brackets-blocked` event is published. Resolution is a future
  product decision.

Phases: `GROUPS` → `DESEMPATE` (only when needed) → `ELIMINATORIES`.

## Schedule

- `scheduled`: the fixture base time (from the seed `timeLabel`).
- `estimated`: computed after results; next match starts at the previous
  result's `recordedAt` + prep minutes (default 5, in TournamentState), and each
  later match starts at the previous estimated end (`matchMinutes`, default 20).
- The first pending match of the day sequence is the derived "in progress" match.

## Brackets & phases

- Phase starts at `GROUPS`. The last group result triggers position computation
  and bracket generation; phase moves to `DESEMPATE` (only if a best-second
  playoff is needed) and then to `ELIMINATORIES` once every DESEMPATE is
  resolved. Bracket generation never fires while a desempate is pending.
- 2 zones: SF1 = A1 × B2, SF2 = B1 × A2, FINAL.
- 3 zones: SF1 = A1 × best second, SF2 = B1 × C1, FINAL.
- FINAL teams are filled when the semifinals return results (bracket slots hold
  no teams before that).
- `/api/state` exposes `phase`, the ordered standings, `desempate`
  (`needed` / `pending` / `match`) and `bracketsBlocked` (`reason` + `teamIds`)
  when the 3+ edge is detected.

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