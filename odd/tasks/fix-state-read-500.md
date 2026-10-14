# Feature: fix-state-read-500 — el heal de eliminatorias no debe tumbar la lectura de /api/state

## Objective
Restaurar `GET /api/state` en produccion, que devolvia **500 vacio** en toda la app
(panel del organizador muerto y home publico en fallback) apenas una etapa llego a
ELIMINATORIES. Branch `feat/selvarena-front` + `main` (Vercel Production). Runner: `npm test`.

## Problem / Why
El commit `1a7ac32` metio `reconcileEliminatories` en el camino de **lectura** de
`getStateSnapshot` (`src/lib/back.ts:795`) para que un cuadro trabado se arregle solo al
refrescar. Ese heal recorre las etapas del bracket (7 para CUARTOS) y cada vuelta abre
`fillDescendantMatches` con una `$transaction` **interactiva** de Prisma. En Turso esa
transaccion toma el write lock y revienta el timeout de 5s -> excepcion no capturada -> 500.

Evidencia medida contra produccion (2026-10-14):

| Endpoint | Resultado |
|---|---|
| `/api/state` (etapas 1, 3, 5 y 6) | **500 en ~5,4s** (uniforme en las 4) |
| `/api/etapas` | 200 en 0,33s |
| `/api/schedule?etapa=<etapa 6>` | 200 en 0,29s |
| `/api/ranking` | 200 en 0,89s |

La base esta sana: el 500 no es de datos ni un reset. Es la unica `$transaction`
interactiva del archivo que vive en un camino de lectura; las otras 5 son de escritura
(`createEtapa` 223, `generateZones` 382, `reorderMatch` 619, `reslotGroupSchedule` 1323,
`editResult` 1634). `recordResult` no usa transaccion interactiva.

Deploy confirmado: el badge publico "BETA TEST 1.13" sale de `formatBetaVersion(BETA_COMMITS)`
con `BETA_BASE_COMMITS=151` -> `BETA_COMMITS=163`, y `git show origin/main:src/lib/beta-commits.ts`
da 163. Produccion estaba en `1a7ac32`, el commit que introdujo el bug.

## Specs
- **S1** — `GET /api/state` debe responder 200 y renderizar la etapa aunque el heal falle.
  El heal es una reparacion, nunca una barrera: `reconcileEliminatories` va dentro de un
  try/catch que loguea y sigue (`src/lib/back.ts`).
- **S2** — `fillDescendantMatches` no debe abrir `$transaction` interactiva. Sus escrituras
  son fill-only e idempotentes, asi que corren secuenciales con `fill(prisma)`.
- **S3** — `src/app/api/state/route.ts` debe devolver el mensaje real de error en JSON
  (`{ error: string }`, status 500) en vez de un 500 vacio.
- **S4** — Sin cambios observables en los fills: `recordResult` y `editResult` siguen
  completando el cuadro igual (REPECHAJE_1 -> CUARTOS_1, semis fijas, cascada).

## Authorized scope
- `src/lib/back.ts` (`getStateSnapshot`, `fillDescendantMatches`)
- `src/app/api/state/route.ts`
- Sin cambios de schema ni de UI.

## Constraints
- `npx tsc --noEmit` limpio + `npm test` verde.
- No tocar Dolce (puerto 3000).
- Commit + push a `main` autorizado explicitamente por el usuario (deploy a produccion).

## Tasks
- [x] T1 — `getStateSnapshot`: envolver `reconcileEliminatories` en try/catch con log (S1).
- [x] T2 — `fillDescendantMatches`: sacar la `$transaction` interactiva, `fill(prisma)` (S2).
- [x] T3 — `/api/state` route: try/catch con mensaje JSON en vez de 500 vacio (S3).
- [x] T4 — Verificacion local: `npx tsc --noEmit` EXIT 0 + `npm test` 271/271 (S4).
- [ ] T5 — Deploy a `main` + verificar `GET /api/state` 200 en produccion.
- [ ] T6 — Verificacion funcional en prod: cargar el resultado de REPECHAJE_1 de la Etapa 6
      y comprobar que completa CUARTOS_1 con el ganador, al lado de Vivi y Santy (1.o de A).

## Estado del cuadro en produccion (Etapa 6, leido via `/api/schedule`)
```
REPECHAJE_1 (16): Dany y Angela  vs  Gabi y Nabi        PENDING
CUARTOS_1   (17): Vivi y Santy   vs  [vacio]  <- espera al ganador del repechaje
CUARTOS_2   (18): Roxi y Gaso    vs  Ruth y Yuli
CUARTOS_3   (19): Seba y Liz     vs  Lu y Mateo
CUARTOS_4   (20): Gonza y Belen  vs  Mati y Cin
```
Es 1v8/2v7/3v6/4v5 correcto. Nada se reseteo: los 15 partidos de zona conservan sus
resultados y la llave esta armada.

## Checks
- Runner: `npm test` (vitest). Tipos: `npx tsc --noEmit`.
- Sin test de regresion nuevo: el fallo es un timeout de lock de Turso, no reproducible con
  SQLite local. La cobertura existente (271 tests, incluidos los de `reconcileEliminatories`
  y del fill RE1 -> CUARTOS_1) cubre la preservacion de comportamiento. La verificacion real
  de S1 es end-to-end contra produccion.

## Log
### L1 — Reporte del usuario (2026-10-14, verbatim)
> algo que esta pasando es que, cargando los datos del torneo llegmos a cuartos de final y el
> sistema no tenia en cuenta que el ganador del repechaje por el segundo mejor tercero, pasaba
> a competir en cuartos con el mejor primero. Entonces paro el sistema y no me dejo cargar mas
> nada. Encima en la pagina principal los cuadros estan todos vacios como si se hubiera
> reseteado la etapa

### L2 — Diagnostico (2026-10-14)
El sintoma reportado ("cuadros vacios como si se hubiera reseteado") es el fallback del home
ante el 500, no un reset. El "no tenia en cuenta al ganador del repechaje" tambien es un
sintoma: el hueco de CUARTOS_1 **es** el ganador del repechaje al lado del 1.o de la zona A.
No se pudo cargar REPECHAJE_1 porque el panel moria con el 500, no por logica de siembra.

### L3 — Fix y verificacion local (2026-10-14)
Fix aplicado (venia del 2026-10-13 15:13, sin commitear). `npx tsc --noEmit` EXIT 0.
`npm test`: 271 tests, 271 pass, 0 fail.
