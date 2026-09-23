# Backend Core — SELVARENA Circuito Mixto 2026

Objective: implement the 8-point backend brief (zoning with manual adjustment, results as the only input, dynamic estimated times, auto brackets, tiebreak, multi-device auth, SSE, tests). Back only. Front visual untouched.

## Problem
The app reads a fixed seed and has no operations for the organizer: no zone tooling, no result entry, no standings, no dynamic schedule, no phase model, no auth.

## Scope (in)
TournamentState (phase, zoneConfirmed, prep/match minutes), User auth, results service, standings, schedule estimates, auto brackets, SSE, node:test coverage. Minimal seed addition: create/upsert the TournamentState row only.

## Constraints / Quality rules
- Results are the ONLY input. Full score OR WINNER_ONLY + explicit winnerId. Never invent points/sets.
- Zone swap exists ONLY before fixture generation (zoneConfirmed). Back MUST reject after.
- "Match in progress" is DERIVED (first pending match in day sequence), never stored.
- Estimates: next start = result recordedAt + prep (default 5 min); chain with matchMinutes (20). Scheduled = base timeLabel; estimated = computed, exposed per match.
- Brackets: last group result → compute positions → generate semifinals. 2 zones: SF1=A1vB2, SF2=B1vA2, FINAL. 3 zones: top of A/B/C + best 2nd (format of seed: 3 bracket slots; define SF1=A1vBest2nd, SF2=B1vC1, FINAL).
- Tiebreak (chosen, reported to user): 1) more wins; 2) set difference from complete matches only; 3) head-to-head; 4) tie unresolved → organizer draw. Never invent points.
- Auth: email+password, single role organizadora, no public signup, multi-device (no cross-invalidation), scrypt hashing (node:crypto, no new deps).
- No mail reminders / Web Push / PWA / visual design (v2 / out of scope).

## Authorized scope
Back: prisma/schema.prisma + migration, prisma/seed.ts (state row only), src/lib/* (new modules + small additions), src/app/api/* (new routes + SSE), package.json (test script), docs (criteria).

## Checklist
- [B1] Schema: Phase enum, TournamentState (zoneConfirmed/prep/match minutes), User (email+scrypt hash), Match.recordedAt; migration + regen client + state row in seed
- [B2] Zoning service: (re)generate zones, manual swap/move team, confirm fixture point-of-no-return; pure guard `canSwap(zoneConfirmed)` + Prisma service; rejects post-confirm
- [B3] Standings lib: rank by zone with tiebreak (PG → set diff → H2H → unresolved) + tests
- [B4] Results service: validate (complete or WINNER_ONLY + winnerId; reject partial), record + close match, recompute standings, derive next match, nudge schedule chain
- [B5] Schedule: per-match {scheduled, estimated} pure chain computation (prep + match minutes from state) + tests
- [B6] Brackets: auto-generate SF/FINAL on last group result; phase flag GROUPS→ELIMINATORIES; 2-zone and 3-zone (+best second w/ tiebreak) + tests
- [B7] Auth: User model usage, scrypt hash/verify, signed session cookie (HMAC, AUTH_SECRET env), POST /api/auth/login + logout, organizer-only guard for mutate routes
- [B8] SSE: GET /api/events stream; events on result loaded, schedule/estimates changed, standings changed, phase change
- [B9] API surface: /api/state (phase+standings+schedule+brackets), /api/zonification (generate/swap/confirm), /api/results (record), /api/schedule
- [B10] Tests (node:test via tsx): swap before/after fixture rejection, estimate chain, brackets 2 & 3 zones, best second ties, tiebreak; run full suite + build
- [B11] Docs: tiebreak + bracket format documented in repo

## Progress
- B1 ✅ schema + migration + client + seed state (commit 7f145b5)
- B2 ✅ zonification pure lib + tests (canSwapZones/swapZone/regenerateZones/zoneSizes)
- B3 ✅ standings pure lib + tests (won → setDiff → h2h → unresolved; WINNER_ONLY never invents sets)
- B5 ✅ schedule pure lib + tests (chain prep/match minutes)
- B6 ✅ brackets pure lib + tests (2 zonas A1×B2/B1×A2; 3 zonas A1×mejor2°, B1×C1; ties block generation conservatively)
- Next: B4 results service (Prisma) → B9 API → B7 auth → B8 SSE → B10/B11 docs+cierre