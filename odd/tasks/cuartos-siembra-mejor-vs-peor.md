# Feature: cuartos-siembra-mejor-vs-peor — siembra 1v8/2v7/3v6/4v5 en cuartos

## Objective
Alinear los cruces del formato CUARTOS (3 zonas, 11-12 equipos) con el torneo real
que armó Andi en su planilla: siembra clasica 1v8 / 2v7 / 3v6 / 4v5 sobre el orden
de clasificados `[A1, B1, C1, A2, B2, C2, mejor3, ganadorRE]`.

## Problem / Why
El motor actual arma los cuartos con un esquema ad-hoc por zona que NO coincide con
la planilla de Andi:
- Actual: `CUARTOS_1` C1 vs A2 · `CUARTOS_2` A1 vs B2 · `CUARTOS_3` B1 vs C2 ·
  `CUARTOS_4` mejor3 vs ganador RE1.
- Andi: `CUARTOS_1` A1 vs RE1 · `CUARTOS_2` B1 vs mejor3 · `CUARTOS_3` A2 vs B2 ·
  `CUARTOS_4` C1 vs C2.

Evidencia (planilla Andi, gid 380883611, Etapa 6):
- Orden de siembra probado = `[A1, B1, C1, A2, B2, C2, mejor3, ganadorRE]`
  (por zona, en orden A,B,C; NO por record/dif — una hipotesis por dif daria GB
  como seed 2, pero Andi tiene RG).
- 1v8 -> A1 vs RE1; 2v7 -> B1 vs mejor3; 3v6 -> C1 vs C2; 4v5 -> A2 vs B2.
- Ganadores reales: Q1=A1(VS), Q2=B1(RG), Q3=B2(LM), Q4=C1(GB).

## Scope
- `src/lib/brackets.ts`: `buildCuartosBrackets` (cruces) + `nextRoundPairingsCuartos` /
  `getCuartosSemifinalPairings` (semis fijas) + tipo `BracketPairing` (teamBId nullable).
- `src/lib/back.ts`: `fillDescendantMatches` (rama CUARTOS/REPECHAJE_1 ->
  `CUARTOS_1`; rama cuartos -> semis fijas) + `getCuartosSemifinalPairingsFromBack`.
- Tests: `src/lib/brackets.test.ts`, `src/lib/back.integration.test.ts`.
- Sin cambios de UI ni de schema. Rama `feat/selvarena-front`.

## Constraints
- NO push. Commit solo si el usuario lo pide.
- `npm test` DOS veces (flakiness conocida) + `npx tsc --noEmit`.
- No tocar Dolce (puerto 3000). Otra sesion trabaja el front: cambios solo back/tests/docs.

## Authorized scope (pedido del usuario)
1. `buildCuartosBrackets` -> pares 1v8/2v7/3v6/4v5:
   - `REPECHAJE_1`: los dos terceros que NO son el mejor 3.
   - `CUARTOS_1`: A1 vs ganador de `REPECHAJE_1` (teamB null al armar; lo llena RE1).
   - `CUARTOS_2`: B1 vs mejor 3.
   - `CUARTOS_3`: A2 vs B2.
   - `CUARTOS_4`: C1 vs C2.
2. Semis fijas `(Q1,Q4) -> SEMIFINAL_1` y `(Q2,Q3) -> SEMIFINAL_2`, SIN la regla de
   "evitar misma zona" ni la de "descanso del ganador de Q4".
   Razon: la planilla de Andi tiene `SEMIFINAL_1` = VS(A) vs GB(C) = Q1w vs Q4w y
   `SEMIFINAL_2` = RG(B) vs LM(B) = Q2w vs Q3w. Andi SI tiene una semi de misma zona
   (B vs B), asi que "evitar misma zona" es incompatible con su bracket. El orden de
   slots (`REPECHAJE_1, CUARTOS_1..4, SEMIFINAL_1, SEMIFINAL_2, BRONZE, FINAL`) ya
   coincide con el orden de la planilla; no se toca.
   ESTO SUPERSEDE la regla de la spec vieja `cuartos-format.md` (linea 54-57).
3. `reconcileAfterMatch` (rama DESEMPATE, CUARTOS): el ganador del desempate del mejor
   3 ahora entra en `CUARTOS_2` (via `resolvedThirdId`), no en `CUARTOS_4`. La logica
   ya es generica; solo cambia el destino derivado de `buildCuartosBrackets`.

## Tasks
- [x] T0 — Doc ODD + espejo engram.
- [x] T1 — `brackets.ts`: cruces 1v8/2v7/3v6/4v5 + `BracketPairing.teamBId` nullable.
- [x] T2 — `brackets.ts`: semis fijas (Q1,Q4)+(Q2,Q3); limpiar `getCuartosSemifinalPairings`.
- [x] T3 — `back.ts`: RE1 -> `CUARTOS_1`; semis fijas; limpiar helper de descanso.
- [x] T4 — Tests brackets + integration al nuevo bracket + DATO en `cuartos-format.md`.
- [x] T5 — `npx tsc --noEmit` + `npm test` x2.
- [x] T6 — Reset de Etapa 6 (solo resultados + llave) para revalidar la siembra
  recargando los resultados a mano contra el bracket real de Andi.

## Acceptance criteria
- `buildCuartosBrackets` devuelve exactamente: RE1 (dos terceros perdedores),
  C1=A1 vs null, C2=B1 vs mejor3, C3=A2 vs B2, C4=C1 vs C2.
- Tras jugar RE1, `CUARTOS_1.teamB` = ganador de RE1 y los otros 3 cuartos ya tienen
  ambos equipos.
- Tras los 4 cuartos: `SEMIFINAL_1` = Q1w vs Q4w, `SEMIFINAL_2` = Q2w vs Q3w.
- Semis -> BRONZE (perdedores) + FINAL (ganadores) sin cambios.
- El camino de desempate del mejor 3 sigue funcionando y ubica al ganador en C2.

## Progress / Evidence
- T1-T3 aplicados en `src/lib/brackets.ts` + `src/lib/back.ts` (sin commit, worktree).
- T4: `brackets.test.ts` test 1 usa los numeros reales de Andi (A3 33/42, B3 25/42,
  C3 23/43) y verifica los pares exactos; integration cubre RE1->C1, semis fijas y el
  camino de desempate (ganador -> C2).
- T5: `npx tsc --noEmit` -> EXIT 0. `npm test` x2 -> 228/228, 0 fail (ambas corridas).
- Sin push. Commit pendiente de decision del usuario.

### T6 — Reset de Etapa 6 para verificacion manual (2026-10-13)
- Objetivo: que el usuario recargue TODOS los resultados por UI y comprobar que el bracket
  que arma el codigo nuevo coincide con el de Andi.
- Base activa del dev server (puerto 3001) = `prisma/dev.db` (esta lockeada por el proceso y
  contiene la etapa `cmv02ta5k0000mwgymiotc6qv`). `dev.db` de la raiz (26/9) y
  `test_integration.db` son viejos y NO se tocaron.
- Backup previo: `C:\Users\gas_5\AppData\Local\Temp\opencode\eclipse-devdb-backup-20261013-103527.db`.
- Script one-shot (no commiteado): `scripts/reset-etapa-6.ts`.
  Correr con `$env:DATABASE_URL="file:./prisma/dev.db"; npx tsx scripts/reset-etapa-6.ts`
  desde la raiz del repo.
- Dump de verificacion (read-only, one-shot): `scripts/dump-etapa-6.ts` — imprime el fixture
  de zona con equipos y el estado de los 9 slots de bracket. Mismo comando con `dump-etapa-6.ts`.
- Post-reset verificado en la base: 15 partidos de zona con ambos equipos y sin resultado
  (Zona A: Ruth y Yuli, Gus y Gise, Vivi y Santy, Seba y Liz · B: Lu y Mateo, Dany y Angela,
  Roxi y Gaso, Maxi y Kari · C: Mati y Cin, Gonza y Belen, Gabi y Nabi), 9 slots de bracket
  vacios, `phase=GROUPS`.
- Decision de alcance: se preservan equipos, zonas y fixture (11 equipos, `zoneConfirmed=true`)
  y se limpia SOLO resultados + llave. Recrear la etapa con `create-etapa-6.ts` re-randomizaria
  las zonas y romperia la comparacion.
- Estado "antes" (codigo viejo): grupos completos, RE1 y CUARTOS_1 con resultado, y cruces
  viejos C1=C1 vs A2, C2=A1 vs B2, C3=B1 vs C2 — que NO coinciden con Andi.
- Resultado del reset: 24 partidos a `PENDING`, 9 slots de llave sin equipos, `phase=GROUPS`.
- Verificado por API (`/api/state`): phase GROUPS, 0/24 con sets, los 9 slots vacios.
- HECHO (2026-10-13, T8): el usuario recargo todo y la validacion manual quedo COMPLETA.

### T7 — Bug: RE1 WINNER_ONLY no llenaba CUARTOS_1 (2026-10-13)
- Sintoma: el usuario cargo todos los grupos + RE1 (solo ganador, WINNER_ONLY) + C2/C3/C4 y
  la UI lo dejo cargar hasta CUARTOS_1: quedaba "Vivi y Santy vs —". Ni RE1 ni C1 eran
  editables (RE1 bloqueado por `DESCENDANT_STAGES` porque C2/C3/C4 ya jugados; C1 no tenia rival).
- Causa raiz (bug mio): en `src/lib/back.ts` `fillDescendantMatches`, la rama CUARTOS/
  REPECHAJE_1 filtraba `resultStatus: "COMPLETE"`. El usuario registro RE1 como WINNER_ONLY
  (solo ganador, sin sets) -> `findFirst` devolvia null -> `return false` -> `CUARTOS_1.teamB`
  nunca se llenaba. Era el UNICO gate "COMPLETE" del archivo; el resto usa `{ not: "PENDING" }`
  (~lineas 1284 y 1454).
- Fix (aplicado, sin commit): `resultStatus: { not: "PENDING" }` + endurecido: llenar primero
  el lado B y caer a A solo si B esta tomado (nunca el mismo equipo en ambos lados).
- Test de regresion en `back.integration.test.ts` (describe CUARTOS): "CUARTOS: a WINNER_ONLY
  REPECHAJE_1 result fills CUARTOS_1's open side" — crea etapa CUARTOS, arma estado
  ELIMINATORIES directo, `recordResult({ matchId: re1.id, winnerId })` y assert de
  `CUARTOS_1.teamBId === winnerId` (falla con el gate viejo, pasa con el fix).
- Verificacion: `npx tsc --noEmit` limpio + `npm test` -> 237/237, 0 fail (era 228; +9: este
  test + `front/bracket.test.ts` de la otra sesion, que tambien pasa).
- Reparacion del estado (one-shot, no commiteado): `scripts/repair-cuartos1-from-re1.ts` — lee
  el ganador de RE1 y lo setea en `CUARTOS_1.teamBId` (nunca toca `teamAId`; no-op si ya esta
  completo). Salida: CUARTOS_1 = Vivi y Santy vs Dany y Angela.
- Estado final verificado (dump): 19/24, phase=ELIMINATORIES, C1=Vivi y Santy vs Dany y Angela,
  C2=Roxi y Gaso vs Ruth y Yuli, C3=Seba y Liz vs Lu y Mateo, C4=Gonza y Belen vs Mati y Cin,
  semis vacias (se llenan al jugar los cuartos).
- LECCION: el fill de descendientes debe tratar WINNER_ONLY y COMPLETE por igual; la carga
  de la app semanal usa "solo ganador" a veces, no siempre sets.

### T7.1 — Incidente: el test de regresion filtro etapas de test a la base real (2026-10-13)
- Sintoma: el usuario vio en la UI una etapa "Cuartos WinnerOnly" con equipos "Eq1..Eq11"
  (el bracket mostraba "Eq1 vs Eq2" — el usuario lo escribio como "Eq1 vs Eqq4").
- Diagnostico: era el residuo del test de regresion T7. El primer run targeteado
  `npx tsx --test --test-name-pattern="WINNER_ONLY REPECHAJE_1" src/lib/back.integration.test.ts`
  (con `$env:DATABASE_URL="file:./prisma/dev.db"` en el shell) ESCRIBIO la etapa de test en
  `prisma/dev.db`. Reproducible: un segundo run del mismo comando creo OTRA etapa identica.
- Contraprueba: `npm test` completo y `node --import tsx --test ...` (la forma del script)
  NO filtran: ni con el env del shell puesto ni sin el. La variable es el prefijo
  `npx tsx --test` (mecanismo exacto no determinado; empiricamente confirmado 2x filtra,
  la forma `node --import tsx` 0x).
- Fix del harness (aplicado en `back.integration.test.ts`): forzar a nivel de MODULO
  (antes del before hook y de cualquier import dinamico de ./prisma):
  `process.env.DATABASE_URL = dbUrl; process.env.TURSO_DATABASE_URL = ""; process.env.DATABASE_AUTH_TOKEN = "";`.
- Limpieza de la base real: `scripts/cleanup-test-etapas.ts` (one-shot) borro las 2 etapas
  "Cuartos WinnerOnly" (teams+matches+state+etapa). Resta solo Etapa 6.
- VERIFICADO POST-FIX: run targeteado con `node --import tsx --test --test-name-pattern=...`
  (con y sin env del shell) -> 1 test pass, `prisma/dev.db` queda con 1 sola etapa, 0 equipos "Eq*".
- REGLA OPERATIVA: para runs targeteados de tests de back usar SIEMPRE
  `node --import tsx --test --test-name-pattern="..." <file>` (igual que npm test),
  NUNCA `npx tsx --test ...`.

### T8 — Validacion manual COMPLETA (2026-10-13)
- El usuario recargo los 15 resultados de zona, RE1 y toda la llave: 24/24, todo WINNER_ONLY.
- Cruces finales verificados en base (dump-etapa-6):
  - CUARTOS_1 = Vivi y Santy vs Dany y Angela — A1 vs ganador de RE1 (siembra 1v8).
  - CUARTOS_2 = Roxi y Gaso vs Ruth y Yuli — B1 vs mejor 3 (siembra 2v7).
  - CUARTOS_3 = Seba y Liz vs Lu y Mateo — A2 vs B2 (siembra 4v5).
  - CUARTOS_4 = Gonza y Belen vs Mati y Cin — C1 vs C2 (siembra 3v6).
  - IDENTICOS a la planilla de Andi (evidencia gid 380883611).
- Semis via flujo vivo (fillDescendantMatches): SF1 = VS vs GB (Q1w vs Q4w),
  SF2 = RG vs LM (Q2w vs Q3w) — igual a Andi.
- El fix de T7 se ejercito en produccion: la carga completa fue solo-ganador (WINNER_ONLY),
  incluso RE1 — el fill RE1->C1, cuartos->semis y semis->BRONZE/FINAL no se trabo en ningun punto.
- Acceptance criteria: TODAS verificadas manualmente + suite 237/237.

## Gotchas
- [AGREGADO] `npx tsx --test` (prefijo tsx directo) puede escribir la base REAL en tests que
  usan `process.env.DATABASE_URL` + `@/generated/prisma/client` con output custom.
  Usar siempre `node --import tsx --test`, que es lo que hace el script `npm test`.
- Otras bases: `dev.db` en la raiz del repo (26/9, etapa 1/3/5 VIEJAS) y `test_integration.db`
  son STALE y NO se tocan; los scripts one-shot exigen `$env:DATABASE_URL="file:./prisma/dev.db"`
  o conectan a `file:./dev.db` por default (relativo al cwd) y muestran datos viejos.

## Gotchas
- `getCuartosSemifinalPairings` (brackets.ts) ya devolvia (Q1,Q4)+(Q2,Q3) pero su loop
  era codigo muerto: retornaba siempre la opcion 1. `nextRoundPairingsCuartos` no se usa
  en el flujo vivo (lo maneja `fillDescendantMatches`).
- `nextRoundPairings` devuelve su propio tipo inline `{teamAId: string; teamBId: string}`;
  no usa `BracketPairing`, asi que ensanchar `BracketPairing.teamBId` no lo afecta.
- Los slots de bracket se crean sin equipos; `finalizeBrackets` hace `updateMany` con
  `teamBId: null` para `CUARTOS_1`, lo cual es valido en Prisma.
