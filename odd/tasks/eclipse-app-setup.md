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

- [ ] T1: Scaffold Next.js app (App Router + TS + Tailwind + ESLint + src dir) — `npm run build` passes
- [ ] T2: Prisma + SQLite wired; core schema (Team, Match, ResultStatus, Stage, Zone) migrated — migrate applies, client generates
- [ ] T3: Placeholder home page with circuit identity + DB team count — build passes, dev boot OK
- [ ] T4: `git init` + initial work-unit commit with Conventional Commit message

## Progress

- T1: DONE 2026-09-22 — create-next-app scaffold succeeded, structure verified.
- T2: pending
- T3: pending
- T4: pending

## Delivery

Forecast: well under 400 authored lines. Strategy: single commit on main (initial setup).