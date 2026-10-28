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
2. **Set difference**, computed from complete-score matches only, counting
   SETS WON per match (`sets[]` → wins per team; 2-1 gives set diff +1).
   WINNER_ONLY matches never invent sets (they contribute wins only).
3. **Point difference** (points for − points against), complete-score matches
   only. WINNER_ONLY matches contribute no points.
4. **Points for**, complete-score matches only.
5. **Head-to-head**, and only as the LAST resort: wins among the teams that
   still tie on 1-4. It only applies inside a zone, because those teams faced
   each other. A single win settles a two-team tie.

Name and id are NEVER a tiebreak. A group that survives the whole chain (3+
teams with a circular head-to-head — every match 21-19/19-21 is enough) stays
`unresolvedTie` and the bracket refuses to seed that zone:
`Zone X: tie unresolved`. The system reports the tie instead of inventing an
order; resolution is an organizer decision.

### Manual resolution of a zone tie

When that happens the system stays on standby: no bracket matches are created,
the phase stays `GROUPS`, and `/api/state` reports
`bracketsBlocked.reason = "zone_tie"` with the tied team ids.

The organizer resolves it from the panel (`POST /api/zone-tie`, organizer
session only) with an explicit order of exactly the teams that are still tied,
best position first. The order is stored in `ZoneTieResolution` (one row per
etapa + zone, confirming again replaces it), feeds the zone standings, and the
bracket is built as soon as nothing else blocks it. A stored order that no
longer matches the current tie (results changed) is ignored and the zone goes
back to blocked.

The table comes from migration `20261028120000_add_zone_tie_resolution`. If a
database does not have it yet, the state read keeps working (the order is
simply absent) and the endpoint answers `503 zone_tie_storage_unavailable`.

Zone ties therefore always resolve into positions. The only tie case the
system refuses to resolve silently is the cross-zone best-second fight
(below).

## Best second & DESEMPATE (3-zone format only)

- Cross-zone seconds never faced each other: head-to-head does NOT apply.
  Comparison is (wins, set difference, point difference). Points for is
  deliberately not used: a desempate match is fairer than a metric nobody
  agreed on.
- **Unique best** → qualifies directly, brackets build immediately.
- **Exactly two seconds tied** → a `DESEMPATE` match is created between them
  for the qualifying spot. It is a regular Match: it enters the schedule
  estimate chain (no base fixture time; estimated only), Andi loads it with
  the normal result flow, and it fires the same SSE events (result + phase).
  The bracket generation WAITS for its result.
- **3+ seconds tied for the spot** → the engine does not invent a tiebreaker:
  `/api/state` exposes `bracketsBlocked` with `reason: "three_seconds_tie"` and
  the tied team ids, an SSE `brackets-blocked` event is published, and the
  bracket waits. The organizer then names the one that qualifies through
  `MejoresSegundosPanel` → `POST /api/best-second` → `resolveBestSecond`
  (guards: STANDARD format, `GROUPS` phase, every group match loaded, team
  really in the tie, no pending `DESEMPATE`). Only the top of that mini-ranking
  reaches `SEMIFINAL_1`; the other two seconds play no bracket match, so no
  order is stored — there is nothing else to order.

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
  `npx tsx scripts/create-organizer.ts <email> <username> <password>` (no public
  signup). Contra una base remota (Turso de producción) el script se niega salvo
  que se pase `--allow-remote`.
- Los scripts de `scripts/` que escriben pasan por el guard
  (`scripts/lib/remote-write-guard.ts`): una base local `file:` corre sin
  ceremonia; una base remota se rechaza salvo `--allow-remote`. Es la barrera
  contra correr un one-shot con las credenciales de producción exportadas.
- `AUTH_SECRET` is required in production; outside production it falls back to
  a dev-only value (set it before deploying).