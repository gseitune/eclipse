# SELVARENA Backend Criteria

Reference for the organizer (and the front): how results, standings, schedule
and brackets behave. Back feature doc: `odd/tasks/eclipse-backend-core.md`
and `odd/tasks/selvarena-back-multiset.md`.

## Results (the only input)

A result is recorded once per match via `POST /api/results` (and edited via
`PATCH /api/results/:id`). Re-recording returns `409`. Both record and edit
share ONE validation path (`resolveResultPayload`).

Payload (either mode):

- **Complete score (multi-set)**: `setFormat` + `sets[]` where each set is
  `{ teamA: number, teamB: number }`. The winner is ALWAYS derived from the
  sets; a conflicting explicit `winnerId` returns `400`.
- **WINNER_ONLY**: no sets, only an explicit `winnerId` that must be one of
  the two teams. Allowed in every stage. Never a partial score.
- Missing both sets and winner returns `400`.

### Formats by stage

| Stage | Allowed setFormat | Set count |
| --- | --- | --- |
| GROUPS / DESEMPATE | `SINGLE_21` | exactly 1 set (to 21) |
| SEMIFINAL_1 / SEMIFINAL_2 | `SINGLE_21` or `TWO_15_TIEBREAK` | 2 sets (2-0 sweep) or 3 (1-1 → third set REQUIRED) |
| FINAL | `BEST_OF_3_21` | 2 sets (2-0, cuts) or 3 (2-1); never 1 or 4 |

A format not allowed for the stage returns `400`. `setFormat` may be omitted
per match (the organizer picks at load time) when sets are present; a payload
with sets but no format returns `400`.

### Win-by-2 set rule

A set is valid when `high >= cap AND high - low >= 2` (cap: 21 for
`SINGLE_21`/`BEST_OF_3_21`, 15 for `TWO_15_TIEBREAK` including the third
set). So `21-20` and `15-14` are `400 invalid_set_score`; `22-20` and
`16-14` are valid. Set-count / sweep violations return
`400 invalid_set_count` (1 or 4 sets), `400 third_set_required` (2 sets at
1-1) or `400 match_already_decided` (a set that continues after a 2-0
sweep).

## Standings & tiebreak

Per zone, sorted by:

1. **More wins** (games won).
2. **Head-to-head**: within a zone, the winner of the direct match ranks
   above. Works with any decided match — WINNER_ONLY is enough (uses
   `winnerId`, no scoreboard needed) or a complete score.
3. **Set difference**, computed from complete-score matches only, counting
   SETS WON per match (`sets[]` → wins per team; 2-1 gives set diff +1).
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
- Each row exposes the match payload (`sets`, `setFormat`) and an `editable`
  flag (see edit guard below).

## Editing results (PATCH)

- `PATCH /api/results/:id` accepts the same payload as record (multi-set or
  WINNER_ONLY) and re-runs the SAME validation + standings/bracket
  reconciliation. Editing a match with no recorded result returns `409`; the
  descendant guard (`editing_blocks_bracket`) blocks editing once a downstream
  phase already played (e.g. a semifinal once the FINAL played).
- `/api/state` exposes `sets[]`, `setFormat` and `editable` per match so the
  front can offer editing only when it is safe.

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