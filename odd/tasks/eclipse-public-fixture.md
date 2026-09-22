# Feature: eclipse-public-fixture

**Objective**: Turn the home into the public tournament page: identity header, zones, and the FULL 23-match schedule grouped by phase (group phase per zone, then semifinals + final), with result-status badges. No data entry yet.

**Why**: The reader view is the core value of the site — people check the day's schedule and (later) live results. All matches are `PENDING` until Andi's contrabrief defines result entry rules.

**Scope**: read-only rendering from DB. No auth, no admin screens, no result entry, no standings calculation (next features).

**Constraints**:
- Schedule data = seeded brief (20 group matches with times + 3 bracket slots).
- Bracket rows (SF1/SF2/Final) have null teams; render fixed label placeholders by stage ("1° A vs 2° B" etc.) until positions resolve.
- UI copy in English (artifact contract); team names are proper nouns kept as-is.
- Status badge shows ResultStatus: PENDING → "Pending" (all now); WINNER_ONLY / COMPLETE render later.
- Data-quality rule (full score OR explicit winner-only) is a UI concern for the future results view — not today.
- `await connection()` before DB reads keeps the page dynamic.
- TDD mode: unknown → ordinary functional checks (build + dev HTTP).

**Checks**:
- `npm run build` passes (route stays `ƒ Dynamic`)
- Dev HTTP 200 contains: a seeded pair ("Lu y Gus"), times ("10:00 - 10:20"), bracket labels ("Semifinal 1"), 23-status Pending rows

## Checklist

- [x] T1: Page renders group phase by zone (A then B) with time + pairs + Pending badge
- [x] T2: Page renders bracket (SF1, SF2, Final) with stage labels
- [x] T3: Build + dev boot verified
- [x] T4: Commit `9cf2946` (`feat: add public match schedule to home`) + push

## Progress

- T1: DONE 2026-09-22 — zone sections render 10 group matches each with time + pairs + badge.
- T2: DONE 2026-09-22 — bracket renders SF1/SF2/Final with stage title + placeholder pairing (typed `BracketStage`; no GROUPS index issue).
- T3: DONE 2026-09-22 — build passes (route `ƒ Dynamic`); dev HTTP 200; 23 `Pending` badges (HTML+`<!-- -->` separators quirk; RSC payload duplicates texts — count in clean HTML is exactly 23).
- T4: DONE 2026-09-22 — pushed `9cf2946`.

## Delivery

Forecast: ~150 authored lines. Strategy: single commit to `main`.