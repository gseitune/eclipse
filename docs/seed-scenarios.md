# Seed Scenarios — multi-set model (sets[] + setFormat + diff-2)

> **STATUS: PREPARED — NOT INSERTED.**
> Prepared against the NEW Match model (`sets[]`, `setFormat`, win-by-2
> validation) that the back (`feat/selvarena-front`) is migrating to.
> Do NOT apply any of this data until the migration closes and the user
> gives the OK. The seed/result code still uses `setAScore`/`setBScore`.

## Format tokens (PROPOSED — mapping to the back's final enums pending)

| Token | Meaning | Sets | Win condition |
| --- | --- | --- | --- |
| `GROUP_1X21` | Groups, Etapa 5 rule | 1 | First to 21, win by 2 |
| `SEMI_2X15` | Semifinals | Best of 3 | Each set first to 15, win by 2 |
| `FINAL_3X21` | Final | Best of 3 | Each set first to 21, win by 2 |

Generic validation: a set count is valid when `diff >= 2` and the loser
score is `< cap` (or the set played past the cap only by a 2-point margin,
e.g. `22-20` at cap 21 is valid; `21-20` and `24-23` are not).

---

## 1. SEMIS 2x15

Teams (Etapa 5 real): `Lu y Gus` (A1) vs `Sil y Lucas` (B2) → `SEMIFINAL_1`.

### 1a. Win in two sets

```json
{
  "matchId": "<SEMIFINAL_1 id>",
  "format": "SEMI_2X15",
  "sets": [
    { "teamA": 15, "teamB": 13 },
    { "teamA": 16, "teamB": 14 }
  ]
}
```

Expected state: `resultStatus=COMPLETE`, winner derived = `Lu y Gus`
(2 sets to 0). Note `16-14` is valid: at cap 15, winner must be ahead by 2,
so the set extends to 16.

### 1b. 1-1, third set decides

```json
{
  "matchId": "<SEMIFINAL_1 id>",
  "format": "SEMI_2X15",
  "sets": [
    { "teamA": 15, "teamB": 11 },
    { "teamA": 13, "teamB": 15 },
    { "teamA": 15, "teamB": 12 }
  ]
}
```

Expected state: `resultStatus=COMPLETE`, winner = `Lu y Gus` (2-1 in sets),
third set also capped at 15.

---

## 2. FINAL — best of 3

Teams: winner SF1 (`Lu y Gus`) vs winner SF2 (`Vivi y Santy`) → `FINAL`.

```json
{
  "matchId": "<FINAL id>",
  "format": "FINAL_3X21",
  "sets": [
    { "teamA": 21, "teamB": 18 },
    { "teamA": 19, "teamB": 21 },
    { "teamA": 22, "teamB": 20 }
  ]
}
```

Expected state: `resultStatus=COMPLETE`, winner = `Lu y Gus` (2-1 in sets).
`22-20` is the canonical diff-2 over-cap case: at cap 21, neither team is 2
ahead at 21-20, so the set continues until one leads by 2.

---

## 3. NO-SHOW

Teams: `Sil y Lucas` (present) vs `Mati y Cin` (absent) → group slot 20
(`16:20 - 16:40`).

```json
{
  "matchId": "<slot-20 id>",
  "format": "GROUP_1X21",
  "sets": [
    { "teamA": 21, "teamB": 1 }
  ]
}
```

Expected state: `resultStatus=COMPLETE`, winner = `Sil y Lucas`. The score
passes every validation (`21-1`, diff 20 ≥ 2) and is indistinguishable in
storage from a real result.

Open data decisions (for the back, NOT blocking this doc):
- There is no dedicated "absent team" marker in the model. Absence is
  represented implicitly by the score. Option: add `noShow`/`absentTeamId`
  so standings/UI can render a walkover instead of a 21-1.
- With no marker, seats are earned normally (win counts as any other).

---

## 4. DESEMPATE — 3 zones, best seconds tied

Hypothetical reproduction with **12 teams, 3 zones of 4** (`GROUP_1X21`,
round-robin inside each zone = 6 matches per zone, 18 group results).

Teams (10 real Etapa 5 + 2 placeholders for the hypothetical grid):

- Zone A: `Lu y Gus`, `Alex y Flor`, `Gon y Belén`, `Gabi y Nabi`
- Zone B: `Liz y Sebita`, `Vivi y Santy`, `Mati y Cin`, `Roxi y Dany`
- Zone C: `Enzo y Kari`, `Sil y Lucas`, `Placeholder T11`, `Placeholder T12`

### Group results (complete scores; zone winners and seconds)

Zone A (winners: `Lu y Gus` 3-0; second: `Alex y Flor` 2-1, +1 sets):
```
Lu y Gus     21-15 Alex y Flor
Lu y Gus     21-10 Gon y Belén
Lu y Gus     21-14 Gabi y Nabi
Alex y Flor  21-18 Gon y Belén
Alex y Flor  21-17 Gabi y Nabi
Gon y Belén  21-16 Gabi y Nabi
```
Zone B (winners: `Liz y Sebita` 3-0; second: `Vivi y Santy` 2-1, +1 sets):
```
Liz y Sebita 21-13 Vivi y Santy
Liz y Sebita 21-11 Mati y Cin
Liz y Sebita 21-12 Roxi y Dany
Vivi y Santy 21-16 Mati y Cin
Vivi y Santy 21-15 Roxi y Dany
Mati y Cin   21-14 Roxi y Dany
```
Zone C (winners: `Enzo y Kari` 3-0; second: `Sil y Lucas` 1-2, -1 sets):
```
Enzo y Kari  21-12 Sil y Lucas
Enzo y Kari  21-13 Placeholder T11
Enzo y Kari  21-15 Placeholder T12
Sil y Lucas  21-17 Placeholder T11
Placeholder T12 21-18 Sil y Lucas
Placeholder T11 21-19 Placeholder T12
```

### Why this reproduces the DESEMPATE

- A2 (`Alex y Flor`) 2-1 and B2 (`Vivi y Santy`) 2-1 are the two best
  seconds; C2 (`Sil y Lucas`) 1-2 is out.
- Group format is a single set per match, so sets-won = matches-won:
  **record and set difference ALWAYS collide for equal records**. The two
  seconds are tied on (wins, set diff) → the back creates `DESEMPATE`.
- Per `backend-criteria.md`: cross-zone head-to-head does not apply; exactly
  two tied seconds → DESEMPATE; bracket generation waits for its result.

### Expected state after the 18 group results land

- `Match` `stage=DESEMPATE` created: `Alex y Flor` vs `Vivi y Santy`,
  `slot` = last group slot + 1 (later slots pushed +1), `timeLabel=null`
  (estimated time, enter the schedule chain), `phase=DESEMPATE`.
- Brackets stay blocked until the DESEMPATE is loaded; then:
  `phase=ELIMINATORIES`, SF1 = `Lu y Gus` × DESEMPATE winner,
  SF2 = `Liz y Sebita` (B1) × `Enzo y Kari` (C1).

### Data needed to reproduce (checklist)

- The 12 teams with **fixed** zone assignment (back `generateZones` is
  random; pre-assign zone on `Team` or run the fixed fixture before
  `confirmZonification`).
- `zoneConfirmed=true` before any result.
- The 18 group results above — complete scores preferred (winner-only is
  enough for wins, but set diff needs scores when formats are multi-set).
- Default `TournamentState` (`prepMinutes=5`, `matchMinutes=20`) for the
  DESEMPATE estimated slot.

---

## 5. Etapa 5 current-data check (read-only, 2026-09-23)

Checked live `dev.db` without writing:

| Check | Result |
| --- | --- |
| Teams | 10 — Zone A: 5, Zone B: 5 (brief-canonical) |
| Matches | 23 — 20 GROUPS, SEMIFINAL_1, SEMIFINAL_2, FINAL |
| Slots | 23 unique, no duplicates |
| Bracket slots | 3 empty (semis + final) — correct, filled after group results |
| DESEMPATE | none (0) — correct for 2-zone Etapa 5 |
| Results | 22 PENDING, **1 COMPLETE** |

Fixture consistency: pairs and times match the brief (10:00–16:40, one
court, crossed semis A1-B2 / B1-A2). The brief's incomplete `21 v` result
(16:20, `Mati y Cin` vs `Sil y Lucas`) is **not** loaded — the match stays
PENDING, which respects the "no silent partial data" rule. **No fix needed
there.**

### ⚠️ Inconsistency found (NOT corrected, per instructions)

Slot 1 (`10:00 - 10:20`, Zona A): `Lu y Gus` 2 - 1 `Alex y Flor`,
`resultStatus=COMPLETE`, recorded today 16:43 UTC.

A `2-1` is not a valid beach-volleyball set at cap 21 with diff 2 (would
need to be `21-x` with x ≤ 19). It looks like a dev/test artifact of the
back work, and the new diff-2 validation will reject this shape. **Action
for later (not now): clean slot 1 before applying the multi-set seed.**

---

## Apply checklist (when the OK comes)

1. Back migration closed (Match has `sets[]` + `setFormat` + diff-2).
2. Clean `dev.db` slot-1 artifact (or re-seed from scratch).
3. Update `prisma/seed.ts` to the new model (`sets[]`, `setFormat` per
   stage, no `setAScore`/`setBScore`).
4. Apply scenarios 1–3 on live Etapa 5 slots; scenario 4 only as a fixture
   for an integration/seed test with 12 teams (never on Etapa 5 data).
5. Confirm each scenario's expected state (COMPLETE, derived winner,
   correct phase) before moving to the next.