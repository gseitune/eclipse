# Feature: eclipse-visual-identity

**Objective**: Give the public page a real visual identity — "sunset on the beach" palette built around the Eclipse name: warm amber/orange/rose sun tones over sand, a sun+moon eclipse mark in the hero, harmonized zone cards and match schedule. Light, sunny, tournament-day feel.

**Why**: Gabriel chose the "Atardecer en la playa" direction. The page worked but looked like a neutral template — no brand.

**Scope**: design tokens in `globals.css` (Tailwind 4 `@theme`) + full restyle of `src/app/page.tsx` (hero, zones, fixture, footer). NOT included: admin screens, shadcn/ui, dark "dusk" mode, logo assets, og image.

**Constraints**:
- Light mode locked for now (removed auto dark switch — a beach tournament page stays sunny; dusk mode is a future option).
- Data logic unchanged (same queries, `await connection()`, 23 Pending badges, zone/bracket splits).
- Zone colors: A = amber (sun), B = teal (sea) — both distinguishable, on-brand with the sunset/seaside concept.
- Tailwind v4 tokens via `@theme inline` custom colors (`sand-*`, `sunset-*`); body background = warm sand + soft radial glows.
- UI copy stays English (artifact contract); team names as proper nouns.
- TDD mode: unknown → ordinary functional checks (build + dev HTTP).

**Checks**:
- `npm run build` passes (route stays `ƒ Dynamic`)
- Dev HTTP 200 still contains: "Eclipse", 23 `>Pending<`, "Semifinal 1", "Zona A", a seeded pair

## Checklist

- [x] T1: Tokens sunset/sand + body background glow in `globals.css` (light-only)
- [x] T2: Hero — eclipse mark (sun + teal moon), gradient title, eyebrow, subtitle, meta chips
- [x] T3: Restyle zone cards + fixture rows + bracket + footer with warm palette
- [x] T4: Build + dev verification, commit `e15ba3b`, push, doc + mirror

## Progress

- T1: DONE 2026-09-22 — `@theme inline` colors (sand-50..300, sunset-400..600, ember-500); removed auto-dark switch (light locked); body background = warm sand + two radial glows.
- T2: DONE 2026-09-22 — hero with sun disc (amber→rose radial, glow shadow) + overlapping teal disc (eclipse moon), gradient `Eclipse` title, eyebrow, chips (equipos/partidos).
- T3: DONE 2026-09-22 — zone cards white/70 + border-l accent (A amber, B teal), sand rows, hover bg, bracket labels amber, footer warm.
- T4: DONE 2026-09-22 — build passes (`ƒ Dynamic`); dev HTTP 200 with sun mark, gradient, 23 `>Pending<`, SF1, teal accent. Pushed `e15ba3b`.

## Delivery

Forecast: ~200 authored lines. Strategy: single commit to `main`.