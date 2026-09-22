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
- [x] T5: Replace eclipse moon disc with spinning Mikasa-style beach ball (inline SVG, slow rotation)
- [x] T6: Subtle palm tree silhouettes at bottom corners (fixed layer, behind content)
- [x] T7: Use real photo of the Mikasa BV550C as the spinning hero ball (circular mask)
- [x] T8: Replace palm silhouettes with user's jungle foliage photo as full-page backdrop
- [x] T9: Rename brand to SELVARENA (green gradient title + subtítulo Circuito de beach vóley)
- [x] T10: Replace gradient sun disc with user's sun photo (circular mask, glow kept)

## Progress

- T10: DONE 2026-09-22 — user downloaded `50b3b2ab-9e46-4ebe-ad5e-e3649ef8de5c.jpg`; copied to `public/sun.jpg`; hero sun is now an `<img>` inside `rounded-full overflow-hidden object-cover` with the same glow shadow; radial-gradient disc removed. Pushed `f267a7a`.

- T9: DONE 2026-09-22 — h1 "Eclipse" → "SELVARENA" (selva + arena, una sola a, todo mayúsculas) con gradiente `from-emerald-950 via-emerald-700 to-green-600` (mismo efecto bg-clip-text); subtítulo "Torneo de beach vóley" → "Circuito de beach vóley"; metadata title → "SELVARENA · Circuito Mixto Etapa 5". Pushed `1039c83` (corrección del nombre + mayúsculas en `9ed107f`).

- T8: DONE 2026-09-22 — user downloaded `tropical-leaves-wallpaper-background-natural-jungle-monstera-and-palm-leaves-foliage-pattern-design-in-minimalist-pale-green-color-style-design-for-fabric-print-cover-banner-decoration-vector-3464254851.jpg`; copied to `public/jungle-bg.jpg`; page backdrop = fixed `img` opacity-45 + warm gradient overlay (`from-sand-50/90 via-sand-100/80 to-sand-200/90`) to keep content readable; palm SVG components removed (unused). Content keeps `relative z-10`. Pushed `32f019c`.

- T7: DONE 2026-09-22 — user downloaded `balon-volley-mikasa-bv550c-oficial-playa-324354301.jpg`; copied to `public/ball-mikasa.jpg`; hero replaced inline SVG BeachBall with `<img>` inside `animate-spin-slow` + `rounded-full overflow-hidden object-cover` (circular mask masks the photo's product background); `ring-2 ring-amber-100`. Old SVG component removed (avoids unused symbol). Pushed `ddbc134`.

- T1: DONE 2026-09-22 — `@theme inline` colors (sand-50..300, sunset-400..600, ember-500); removed auto-dark switch (light locked); body background = warm sand + two radial glows.
- T2: DONE 2026-09-22 — hero with sun disc (amber→rose radial, glow shadow) + overlapping teal disc (eclipse moon), gradient `Eclipse` title, eyebrow, chips (equipos/partidos).
- T3: DONE 2026-09-22 — zone cards white/70 + border-l accent (A amber, B teal), sand rows, hover bg, bracket labels amber, footer warm.
- T4: DONE 2026-09-22 — build passes (`ƒ Dynamic`); dev HTTP 200 with sun mark, gradient, 23 `>Pending<`, SF1, teal accent. Pushed `e15ba3b`.
- T5: DONE 2026-09-22 — `BeachBall` inline SVG (white circle + yellow + blue panels, Mikasa VLS-ish colors); `animate-spin-slow` (16s linear) added to globals.css; ball overlaps sun bottom-right with drop shadow. Pushed `c38c1fc`.
- T6: DONE 2026-09-22 — `PalmTree` inline SVG (trunk + 5 fronds, #7c2d12 fill); two palms fixed bottom corners, opacity 25/30%, pointer-events-none, aria-hidden; content wrapped in `relative z-10` so cards stay readable. Pushed `c38c1fc`.

## Delivery

Forecast: ~200 authored lines. Strategy: single commit to `main`.