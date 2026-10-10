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
- **A** [COMPLETA, pendiente de commit]: regla de puntos (standings + selectBestThird + callers + tests).
- **B** [pendiente de autorización]: empate total con 2 caminos (desempate — reusa infra DESEMPATE
  del mejor segundo — o sorteo manual), perdedor/no-elegido → `REPECHAJE_1` vs C3 + card de
  decisión del organizador.
- **C** [pendiente]: slots eliminatorios sin 2 seguidos al crear etapa + re-slot opcional.
- Out: NO commits/push (regla del usuario); no tocar Dolce; sin UI fuera de lo listado; no tocar
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
- [ ] T4 — Sorteo: reusar la elección manual existente (POST /api/best-third); el no-elegido →
      `REPECHAJE_1` vs C3.
- [ ] T5 — Desempate: match `DESEMPATE` entre los empatados; ganador → `CUARTOS_4`
      (resolvedThirdId); perdedor → `REPECHAJE_1` vs C3. Reusar infra de `selectBestSecond`
      (kind "playoff") / `createDesempateMatch`.
- [ ] T6 — Card "Empate en el mejor 3.º": el organizador elige el camino (Desempate | Sorteo).
- C:
- [ ] T7 — Orden de slots eliminatorios al crear etapa para que ningún equipo juegue 2 seguidos
      (C4 después de otros QF; semis ordenadas para que el ganador del último QF descanse).
- [ ] T8 — Re-slot opcional para la etapa en curso (estilo scripts/reslot-etapa.ts).

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
  CUARTOS actualizado a empate de 3 terceros bajo la regla nueva). Pendiente: OK del usuario →
  commit.

## Next step
- Pedir OK para commitear Etapa A (Conventional Commit). Luego B; luego C. Pre-commit pendiente:
  actualizar `odd/tasks/cuartos-format.md` punto 3 (dice "(won, luego setDiff)", regla vieja).