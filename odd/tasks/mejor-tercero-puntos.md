# Feature: mejor-tercero-puntos — regla de Andi + empate con caminos + descanso

## Objective
Implementar la regla REAL del mejor tercero del formato CUARTOS (3 zonas 4/4/3) confirmada con
Andi (vía Gabriel): comparar cada 3º SOLO contra el 1º y 2º de su zona (descarta el partido vs el
4º; normaliza zonas de 4 vs 3) con criterio **ganados → diferencia de puntos → puntos a favor**.
Extender la resolución del empate total a DOS caminos elegidos por el organizador (desempate o
sorteo) y garantizar descanso (ningún equipo juega 2 partidos seguidos).

## Problem
El motor actual (`selectBestThird`, src/lib/brackets.ts ~L236) compara `(won, setDiff)` sobre la
zona COMPLETA: con un set por partido, los 3ºs de zonas de 4 empatan por construcción (−1 setDiff)
y la regla de puntos de Andi NO está implementada (`StandingRow` no tiene pointsFor/pointsAgainst).

## Why
Valor de la inscripción: mínimo de partidos jugados (C3 nunca juega solo 2). Decisiones
2026-10-09/10 (memorias #281/#283/#284): el mejor 3º se define por puntos vs top-2; el empate
total lo resuelve el organizador eligiendo **desempate o sorteo**; los equipos no juegan 2
seguidos (descanso). Confirmado 10/10: en ambas opciones, el que no pasa va al repechaje CONTRA
el tercero de la zona C.

## Scope
- **A** [COMPLETA + commiteada 11305af]: regla de puntos (standings + selectBestThird + callers + tests).
- **B** [COMPLETA]: empate total con 2 caminos (desempate — reusa infra DESEMPATE — o sorteo
  manual), perdedor/no-elegido → `REPECHAJE_1` vs C3 + card de decisión del organizador.
- **C** [COMPLETA]: slots eliminatorios sin 2 seguidos al crear etapa + re-slot opcional.
- Out: NO push (regla del usuario); no tocar Dolce; sin UI fuera de lo listado; no tocar
  la rotación de zonas (`interleaveGroupPairs`, e235946) ni la lógica del mejor segundo.

## Constraints
- Eclipse corre en 3001; Dolce en 3000 (no tocar). No leer `.env`/`.env.*` (bloqueado).
- Prisma 7 lee `DATABASE_URL` de `prisma.config.ts` (no directo de `.env`).
- Tests: `npm test` (`node --import tsx --test`, 14 archivos) — correr DOS veces (flakiness conocida). Tipos: `npx tsc --noEmit`.
- No correr `npm run build` sobre un dir cuyo `.next` sirve `npm start`.

## Tasks
- [x] T0 — Alcance acordado + doc ODD + espejo engram. (orquestador, 2026-10-10)
- A:
- [x] T1 — Standings: `pointsFor`/`pointsAgainst` en `StandingRow` (solo COMPLETE, desde
      setAScore/setBScore; WINNER_ONLY no aporta puntos). => Implementado como `bestThirdStats`
      (stats RESTRINGIDAS vs top-2) + `pointsA/pointsB` opcionales en `StandingInputMatch`
      (fuente real: `countSetPoints` en result-format.ts). Helper
      `bestThirdRestrictedStats(thirdId, topTwoIds, matches, zoneIds)`; invocación post-sort en
      `computeZoneStandings` (fila sorted[2], topTwo = sorted[0]/[1]).
- [x] T2 — `selectBestThird` con la regla de Andi: contar solo los partidos vs el 1º/2º de cada
      zona; criterio (ganados → diff de puntos → puntos a favor). Bloques: empate total →
      `best_third_tie` (sin inventar desempate); WINNER_ONLY en zona → `best_third_needs_scores`
      (razón nueva en src/lib/front/types.ts, type-only).
- [x] T3 — Callers (back.ts: getStateSnapshot ~805, reconcileAfterMatch ~1181, resolveBestThird
      ~1114) + tests (brackets.test.ts + back.integration.test.ts) + tsc + suite ×2.
- B:
- [x] T4 — Sorteo: la elección manual existente (POST /api/best-third → `resolveBestThird`) es el
      camino sorteo; el no-elegido → `REPECHAJE_1` vs C3 (ya cubierto por buildCuartosBrackets).
- [x] T5 — Desempate: `createBestThirdDesempate(etapaId)` (back.ts) valida CUARTOS + fase GROUPS +
      empate `best_third_tie` de EXACTAMENTE 2 y reusa `createDesempateMatch` (match `DESEMPATE`).
      `reconcileAfterMatch` rama DESEMPATE ahora es format-aware: en CUARTOS el ganador entra por
      `resolvedThirdId` → `CUARTOS_4`, perdedor → `REPECHAJE_1` vs C3. Ruta nueva
      `POST /api/best-third/desempate`. `resolveBestThird` rechaza (409 `desempate_already_pending`)
      si hay un desempate pendiente.
- [x] T6 — Card `MejoresTercerosPanel` (ResultadosSection.tsx): con 2 empatados muestra los dos
      caminos (Desempate → botón "Crear partido de desempate" | Sorteo → botones por equipo); con 3
      empatados solo Sorteo; con `best_third_needs_scores` muestra un aviso sin acción; mientras hay
      desempate pendiente oculta las opciones y apunta al partido.
- C:
- [x] T7 — Semis CUARTOS (`getCuartosSemifinalPairingsFromBack`, back.ts): entre las opciones sin
      choque de zona, prefiere las que mandan al ganador del último QF (CUARTOS_4) a `SEMIFINAL_2`,
      que no es adyacente a C4. Los slots ya crean C4 después de los otros QF (createEtapa).
- [x] T8 — `reslotGroupSchedule(etapaId)` (back.ts) + `POST /api/etapas/:id/reslot` + card
      "Rotación del fixture" (ResultadosSection.tsx): reordena los slots de zona a la rotación
      interleave (A,B,C,…). Solo antes de cargar resultados (fase GROUPS y standings en 0; el
      backend rechaza si hay partidos jugados).

## Acceptance criteria (A)
- `selectBestThird` resuelve con la regla de puntos vs top-2 (ej. sintético espejo del real:
  A3 33+/42− = −9 → directo; B3 25+/42− = −17 y C3 23+/43− = −20 → repechaje; ver #281).
- Empate total → blocked `best_third_tie`. Zona con WINNER_ONLY → blocked `best_third_needs_scores`.
- `npx tsc --noEmit` 0 errores; `npm test` verde (×2).

## Checks
- Runner: `npm test` (`node --import tsx --test`). Tipos: `npx tsc --noEmit`. Suite ×2 por flakiness conocida.

## Progress / Evidence
- 2026-10-10: T0 hecho. Regla confirmada (#281 restaurada), bordes (#283/#284), estructura del
  repechaje en empate confirmada por el usuario (perdedor → RE1 vs C3).
- 2026-10-10: Etapa A completa (T1-T3) INLINE (subagente no disponible: "Model is unavailable").
  `npx tsc --noEmit` 0 errores; `npm test` ×2 verde (223/223, 43 suites, incl. describe nuevo
  "selectBestThird (Andi's rule: restricted to the zone top 2, points)"; test de integración
  CUARTOS actualizado a empate de 3 terceros bajo la regla nueva). Commit 11305af (9 archivos,
  +363/−51), sin push.
- 2026-10-10: Etapas B y C completas INLINE. `npx tsc --noEmit` 0 errores; `npm test` ×2 verde
  (224/224, 43 suites; +1 test de integración nuevo "CUARTOS desempate path" con fixture de empate
  de 2 terceros donde C3 pierde por margen distinto y prueba el guard `desempate_already_pending`).
  Al test grande de CUARTOS se le agregó la aserción de descanso (T7): el ganador de CUARTOS_4 va a
  `SEMIFINAL_2`, nunca a la SF1 adyacente. Archivos: back.ts (createBestThirdDesempate,
  reslotGroupSchedule, rama DESEMPATE format-aware, semis reordenadas), brackets.ts sin cambios;
  rutas `api/best-third/desempate`, `api/etapas/[id]/reslot`; front api.ts + ResultadosSection.tsx
  (MejoresTercerosPanel con 2 caminos + RotationPanel). UI en español neutral.

## Next step
- Commit de Etapas B/C (Conventional Commit) — sin push. Luego levantar la app en localhost:3001
  para que el usuario la vea. Sin trackear aún: `scripts/reslot-etapa.ts`, `odd/tasks/agenda-rotacion-zonas.md`,
  `odd/tasks/eclipse-fixes-28.md`.