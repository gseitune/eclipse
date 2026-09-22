# Feature: eclipse-app-setup

**Objective**: Create the Next.js repository for the Eclipse web app (Circuito Mixto Principiantes 2026 — Etapa 5) with database, initial schema, and a boot-verified placeholder.

**Why**: Gabriel approved Option A access model — read-only for the public, admin (Andi) protected writes, developer (Gabriel) full access.

**Scope**: Scaffold the app, wire Prisma + SQLite, define the initial domain schema, replace the default home with a minimal placeholder that proves the DB round-trip. No auth screens, no seed, no fixture yet (next tasks).

**Constraints**:
- Repo: `D:\Proyectos\Eclipse\04-Codigo\eclipse-app`
- Stack: Next.js (App Router, TypeScript, Tailwind), Prisma + SQLite (local dev; switch to Postgres/Neon at deploy)
- Access model for later tasks: public read-only; admin + developer roles
- Data quality rule (later task): results need a full score OR an explicit "winner only" marker — never silent partial data

**TDD mode**: unknown — no project config or explicit choice. Ordinary functional checks only.

**Checks**:
- `npm run build` passes
- Dev server boots and serves the home page
- `prisma migrate dev` applies cleanly
- Home page shows team count from the DB (proves Prisma round-trip)

## Checklist

- [x] T1: Scaffold Next.js app (App Router + TS + Tailwind + ESLint + src dir) — `npm run build` passes
- [x] T2: Prisma + SQLite wired; core schema (Team, Match, ResultStatus, Stage, Zone) migrated — migrate applies, client generates
- [x] T3: Placeholder home page with circuit identity + DB team count — build passes, dev boot OK
- [x] T4: `git init` + initial work-unit commit with Conventional Commit message — remote create/push pending user gh auth

## Progress

- T1: DONE 2026-09-22 — create-next-app scaffold succeeded, structure verified.
- T2: DONE 2026-09-22 — Prisma pinned 7.10.0 (v8-rc rejected); migrated via `npx prisma migrate dev --name init` → `20260922193456_init`; new `prisma-client` generator with output `src/generated/prisma` (v7 removed `prisma-client-js` and schema `url`); runtime uses `@prisma/adapter-better-sqlite3` (class `PrismaBetterSqlite3`).
- T3: DONE 2026-09-22 — home shows circuit identity + team count per zone via `prisma.team.findMany`; `await connection()` keeps the DB read dynamic (route `/` is `ƒ Dynamic`; better-sqlite3 is synchronous and would otherwise prerender with 0 teams). Build + dev boot verified (HTTP 200, "Base de datos conectada").
- T4: DONE (local commit) 2026-09-22 — branch renamed `master` → `main`; root commit `10c3eb9` (`chore: scaffold Next.js app with Prisma SQLite and home page`, 36 files). PENDING: `gh repo create eclipse --public --source . --push` after Gabriel runs `gh auth login`.

## Delivery

Forecast: well under 400 authored lines. Strategy: single commit on main (initial setup).