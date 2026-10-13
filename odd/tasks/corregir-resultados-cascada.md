# Corrección de resultados con cascada (resultados trabados)

Objetivo: que el organizador (Andi) pueda corregir el resultado de un partido aunque los partidos dependientes ya tengan resultado, SIN resetear la etapa — la app invalida solo la cadena afectada y se vuelven a cargar esos partidos.

## Problema
`editResult` bloquea con `409 editing_blocks_bracket` cuando un descendiente ya tiene resultado (`back.ts:1456`). Correcto para proteger la llave, pero sin salida: el único camino era script one-shot o reset completo.

## Por qué cascada (evidencia)
- My Bracket (mybracket.app): "Undo any result at any stage — the bracket recalculates itself" + history "Bracket recalculated". El recálculo en cascada ES la práctica estándar.
- GetPaird (judge guide): "Reset Result clears a previously reported score so it can be entered again" — reset por partido + log de actividad, con permisos separados (Head Judge).
- Challonge/Toornament: no ofrecen reset completo de etapa; la corrección es por match.
- Decisión: NO botón "reiniciar etapa" por ahora (bomba para un cargador de datos; ya existe `scripts/reset-etapa-6.ts`). Posible follow-up: log de actividad.

## Alcance
- Back: `editResult` acepta `cascade?: boolean`. Sin `cascade` → comportamiento actual idéntico (409). Con `cascade` + descendientes con resultado → transacción: borra resultados de TODA la cadena descendiente (cierre transitivo de `DESCENDANT_STAGES`), limpia refs de equipos de slots alimentados por este partido, aplica la edición, re-propaga con `fillDescendantMatches`.
- Caso GROUPS: editar un partido de zona con eliminatorias jugadas → borra TODOS los resultados de eliminatorias + vacía los slots del bracket y re-siembra desde las posiciones corregidas (mismo path que el armado normal del bracket).
- API: `src/app/api/results/[id]/route.ts` (PATCH) pasa `cascade` del body (sin saltar otros guards: requireEtapaOpen, no_result_to_edit, slots con equipo).
- UI: `ResultadosSection.tsx` — `CorregirResultadosPanel` lista los partidos con resultado y `editable === false`, con "Corregir" → diálogo que muestra el nuevo resultado + la lista EXACTA de partidos que se invalidan (labels humanos, desde las mismas constantes del back) → PATCH con `cascade: true` → refresh + recarga del board.
- Tests: integración (`back.integration.test.ts`) para RE1→CUARTOS, CUARTOS→SEMIS, GROUPS→rebracket; más el caso sin cascade (sigue bloqueando). Unit front (`bracket.test.ts`): `cascadeImpact` (cadena precisa, SEMIFINAL_2 independiente sobrevive).

## Constraints / Reglas
- Harness: NUNCA `npx tsx --test` (fuga a base real). Targetear con `node --import tsx --test`. `npm test` completo al final.
- No tocar `prisma/dev.db` con tests; scripts con `$env:DATABASE_URL="file:./prisma/dev.db"`.
- Checks obligatorios: `npx tsc --noEmit` limpio + `npm test` todo en verde (base 237).
- Commits conventional (English) en `feat/selvarena-front`; NO push (decisión del usuario).
- Sin Co-Authored-By.

## Tareas
- [x] T1 back: `EditResultInput.cascade` + closure descendientes + transacción de limpieza (constantes movidas a `src/lib/schedule.ts`, única fuente compartida con la UI) + re-fill + SSE. GROUPS con rebracket.
- [x] T2 API: `results/[id]/route.ts` (PATCH) acepta `cascade` y lo delega al back.
- [x] T3 UI: `CorregirResultadosPanel` — acción "Corregir" en partidos trabados (jugados con `editable === false`, vía board) + diálogo con lista exacta de partidos invalidados (labels humanos + cruces que se vacían) + PATCH `cascade: true` + refresh.
- [x] T4 tests: integración cascada (RE1, CUARTOS, GROUPS, sin-cascade sigue 409) + unit `cascadeImpact` (5 casos: cadena precisa, semi independiente sobrevive, GROUPS, FINAL/BRONZE vacíos, slots re-seed).
- [x] T5 Validación: `npx tsc --noEmit` limpio + `npm test` 246/246 en verde. Smoke real: `/api/schedule` local lista 23 partidos bloqueados (etapa cerrada). Pendiente opcional: prueba manual del happy path PATCH con cascade contra una etapa de test abierta.

## Estado
- [x] Decisión de alcance (cascada, sin botón reset) — usuario.
- [x] Implementado (T1-T5). Motor + API + tests quedaron de la sesión anterior; UI (T3) completada el 13/10 con verificación tsc + 246 tests. Sin push (decisión del usuario al cierre de la sesión original); el usuario confirmó commit+push al terminar la UI.