# Feature: cuartos-format — 3 zonas (11-12 equipos) con repechaje de terceros + cuartos

## Objective
Soportar el formato del domingo 27/9: 3 zonas (11-12 equipos), grupos a 1 set de 21,
y eliminatorias con repechaje de terceros → cuartos → semis → final + bronce (tercer puesto).
> DATO 26/9 (Gabriel, corrección a la spec): SÍ hay partido por el bronce. El formato CUARTOS
> genera `BRONZE` además de `FINAL` cuando terminan las semis.
>
> DATO 26/9 (Gabriel, 2ª corrección): el mejor 3.º lo **elige el organizador**. Los grupos de
> zona se juegan a 1 set de 21, y `setDiff` cuenta sets, no puntos: el 3.º de una zona de 4
> siempre queda 1 ganado / -1, así que los terceros de las dos zonas de 4 empatan
> estructuralmente y `(won, setDiff)` no puede separarlos. El motor se bloquea
> (`best_third_tie`) y el organizador elige con `POST /api/best-third`; el repechage recibe a
> los otros dos. El 3.º elegido entra en `CUARTOS_4` y se deriva del que NO está en el
> repechage, así que la elección no necesita estado persistido.

## Problem / Why
La Etapa 6 (27/09) usa un formato nuevo que el bracket engine actual (STANDARD/REPECHAJE) no soporta:
8 clasificados a cuartos (6 directos + mejor 3.º + ganador del repechaje de los otros dos terceros).

## Scope
- Backend + schema + tests. Sin cambios de UI (solo type-only en `src/lib/front/types.ts` para los nuevos stages/reason).
- Rama: `feat/selvarena-front`.

## Constraints
- Cliente Prisma checked-in: regenerar y commitear.
- Migración: `npx prisma migrate dev --name add_cuartos_stages`.
- Tests: `npm test` DOS veces (flakiness conocida) + `npm run build`.
- Un commit Conventional (mensaje a elección del orquestador, estilo repo).

## Authorized scope (spec del usuario)
1. Schema: `Stage` += `CUARTOS_1..CUARTOS_4`; `BracketFormat` += `CUARTOS`.
2. `createEtapa`: con `bracketFormat === "CUARTOS"` exigir exactamente 3 zonas (11-12 equipos;
   `distributeTeams` da 4/4/3 con 11). Slots post-grupos en orden:
   `REPECHAJE_1` (playoff de terceros), `CUARTOS_1..4`, `SEMIFINAL_1`, `SEMIFINAL_2`, `BRONZE`, `FINAL`.
3. `brackets.ts`: `buildCuartosBrackets` — 1.º y 2.º de A/B/C directos a cuartos; mejor 3.º directo;
   los otros dos terceros → `REPECHAJE_1`; ganador → `CUARTOS_4`.
   - Mejor 3.º: comparar (won, luego setDiff) SOLO contra 1.º y 2.º de cada zona (regla Sheets:
     C jugó 2 partidos, A/B 3 — no se cuentan los partidos contra el 4.º). Empate en la punta
     del tercero → blocked (mismo patrón que `three_seconds_tie`), reason nuevo `best_third_tie`
     (agregarlo al union de reasons en front/types.ts, type-only), sin inventar desempate.
   - Cruces de cuartos concretos: `CUARTOS_1`: C1 vs A2; `CUARTOS_2`: A1 vs B2; `CUARTOS_3`: B1 vs C2;
     `CUARTOS_4`: mejor 3.º vs ganador de `REPECHAJE_1`. Ningún cruce repite zona.
4. Cadena de llenado (`fillDescendantMatches`/`nextRoundPairings`/`finalizeBrackets` en back.ts):
   - `REPECHAJE_1` → llena `CUARTOS_4`.
   - Los 4 cuartos → llenan `SEMIFINAL_1`/`SEMIFINAL_2`: cruce entre ganadores EVITANDO misma zona
     (fill-time: emparejamiento determinista que minimice misma-zona entre los 4 ganadores; preferir
     (QF1,QF4)+(QF2,QF3) y swapear si colisiona; si es inevitable, dejar el emparejamiento con menos
     colisiones y documentar).
   - Semis → `FINAL` (ganadores) + `BRONZE` (perdedores de las semis).
   - `DESCENDANT_STAGES` (schedule.ts): `CUARTOS_1..4` → [SEMIFINAL_1, SEMIFINAL_2, FINAL];
     `REPECHAJE_1` → [CUARTOS_1..4, SEMIFINAL_1, SEMIFINAL_2, FINAL] (union: preserva el comportamiento
     del formato REPECHAJE viejo porque los stages CUARTOS no existen ahí); `GROUPS` y `DESEMPATE` += los 4 CUARTOS.
5. `STAGE_FORMATS` (result-format.ts): `CUARTOS_1..4` → SINGLE_21 (REPECHAJE_1 ya es SINGLE_21 ✓).
   Semis NO se tocan (siguen aceptando SINGLE_21 — lo pedido). Final BEST_OF_3_21 ✓.
6. `getBracketsSnapshot` (back.ts): agregar `CUARTOS_1..4` a la lista de stages del snapshot (y al
   query de llenado de `fillDescendantMatches` si corresponde).
7. Tests (brackets.test.ts + back.integration.test.ts): escenario completo 11 equipos (4/4/3):
cargar los 15 resultados de zona (A: 6, B: 6, C: 3) → verificar repechaje con los dos terceros
    perdedores → jugarlo → verificar cuartos sin cruces de misma zona y repechaje en C4 → jugar
    cuartos/semis → verificar que se crea `BRONZE` (perdedores de semis) + `FINAL` (ganadores) y
    la final queda BEST_OF_3_21.
    Cubrir el caso bloqueado de mejor 3.º empatado.

## Tasks
- [x] T0 — Setup: doc ODD + espejo engram. (orquestador)
- [x] T1 — Schema: Stage CUARTOS_1..4 + BracketFormat CUARTOS + migración + generate. (208e3af)
- [x] T2 — createEtapa: validación 3 zonas (11-12) + slots CUARTOS (8, sin bronce). (a054e0c)
- [x] T3 — buildCuartosBrackets + selectBestThird (regla Sheets, blocked best_third_tie). (a054e0c)
- [x] T4 — Llenado format-aware: RE1→C4, QFs→semis (evitar misma zona), semis→FINAL. (a054e0c)
- [x] T5 — DESCENDANT_STAGES + STAGE_FORMATS + getBracketsSnapshot + front/types.ts (type-only). (a054e0c)
- [x] T6 — Tests (brackets + integration) + suite ×2 + build + commit. (a9b2c7c)
- [x] T7 — Corrección 1: BRONZE en el formato CUARTOS (spec de Gabriel). (a9b2c7c)
- [x] T8 — Corrección 2: el organizador elige el mejor 3º en empate + endpoint + UI. (a9b2c7c)

## Progress / Evidence
- `208e3af` schema (Stage CUARTOS_1..4, BracketFormat.CUARTOS, migración aplicada).
- `a054e0c` formato CUARTOS completo (3 zonas, repechaje, cuartos) — **sin bronce y con el
  mejor 3º calculado automáticamente**, según la spec original.
- `a9b2c7c` cierra el formato: bronce + elección manual del mejor 3º. Tests end-to-end de 11
  equipos (4/3/4) cubriendo el empate estructural, el repechage, los 4 cuartos, las semis, el
  bronce y la final a 3 sets.
- `fa88af5` fix aparte: `computeTimeEstimate` contaba WINNER_ONLY como pendiente.
- Verificación: `npm test` ×2 → 202/202 en verde; `npm run build` OK.

## Gotchas discovered
- `setDiff` de las posiciones cuenta **sets ganados - sets perdidos**, no puntos: en grupos de
  un set, 21-5 y 21-19 valen lo mismo. Cualquier comparación que necesite margen de puntos
  tiene que leer el `sets` JSON, no `setDiff`.
- `getState` devuelve solo la fila de `tournamentState`; el estado con `zones`, `standings` y
  `bracketsBlocked` lo arma `getStateSnapshot`.
- Los slots de eliminatorias se crean con `setFormat: null`; el formato se graba recién al
  cargar el resultado.