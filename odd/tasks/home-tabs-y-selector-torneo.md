# Home: switch de torneo + card unificada con pestañas

## Objetivo
Que el viewer del inicio tenga **control de lo que quiere ver**: un **switch de
torneo** (no desplegable) debajo del hero y arriba de las cards (Principiantes
activo / Intermedios "Próximamente") y una **sola card con 3 pestañas** (Fase de
grupos · Llaves · Posiciones finales) que reemplaza las cards separadas
"Posiciones" y "Cuadro".

## Problema / Por qué
- El inicio mostraba "Cuadro" o "Posiciones" según la fase, sin que el viewer
  pudiera elegir. Referencia: la sección *Standings* de Volleyball World
  (`#round-p` / `#round-elb` / `#round-f`).
- Andi alterna fechas: un día Principiantes, otro Intermedio (sábado/domingo
  variable). Falta el Back de Intermedio → el desplegable lo anuncia en gris.
- El "Cuadro" actual sólo renderiza Semifinales y Final: los Cuartos y el
  Repechaje existen en los datos pero no se veían.

## Alcance
- Switch de torneo **debajo del hero (sol/pelota + textos) y arriba de las
  cards**; funciona como toggle para switchear entre ambos circuitos.
  Intermedios sigue anunciándose como "Próximamente".
- Card unificada con pestañas: `Fase de grupos`, `Llaves`, `Posiciones finales`.
- Pestaña por defecto: `Fase de grupos`; pasa a `Llaves` recién cuando cae el
  primer resultado de llave (misma regla que el gate anterior).
- Pestaña Llaves: cuadro **de izquierda a derecha** (ronda más temprana a la
  izquierda, Final a la derecha; 3er y 4to puesto debajo de la Final), con el
  marcador según regla. Va **compacto, sin recuadro por enfrentamiento** (las
  líneas finas separan los partidos y las columnas) y **siempre dentro de la
  card**: de `sm` para arriba son columnas y en celular las rondas se apilan,
  así que nunca hay scroll horizontal.
- "Posiciones finales": **sólo primero, segundo y tercero** (podio).
- `RankingPanel` queda con "Puntos del circuito".

## Fuera de alcance
- Datos/Back de Intermedio (no existe todavía).
- Cambiar endpoints o el modelo de datos.

## Regla de marcador (acordada)
- Sin `sets` (WINNER_ONLY) → sólo el ganador (sin número).
- 1 set (`SINGLE_21`) → **puntos** de ese set (ej. `21–15`).
- 2+ sets (`BEST_OF_3_21`, final) → **sets ganados** (ej. `2–1`).

## Restricciones
- Puertos: app en 3001 (Dolce en 3000). No commitear sin pedido explícito.
- Comentarios de código en inglés; UI en español. Estilo Tailwind existente
  (`sand-*`, `amber-*`, `ember-*`, `stone-*`).
- TDD del proyecto: `npm test` (node:test) + `npx tsc --noEmit`.

## Checklist
- [x] T1 `src/lib/front/bracket.ts` — helpers puros `matchScore` + `groupBracketColumns` + tests
- [x] T2 `TournamentSwitch.tsx` — switch Principiantes / Intermedios (Intermedios con tag "Próximamente")
- [x] T3 `StandingsTables.tsx` — contenido sin chrome de card (lo provee la tabs)
- [x] T4 `EliminatoriesView.tsx` — contenido sin chrome, cuadro izq→der, marcador
- [x] T5 `FinalStandings.tsx` — selector de etapa + podio (sólo 1º/2º/3º)
- [x] T6 `TournamentTabs.tsx` — card con 3 pestañas + default dinámico
- [x] T7 `RankingPanel.tsx` — quitado bloque "Posiciones por etapa" (quedó "Puntos del circuito")
- [x] T8 `PublicHome.tsx` — estado de torneo + switch debajo del hero; rama vieja reemplazada
- [x] T9 Verificación: `npx tsc --noEmit` OK · `npm test` 236/236 · `eslint` limpio
- [x] T10 Feedback ronda 2: switch (no `<select>`) movido debajo del hero, `Hero.circuit` dinámico,
      panel "Próximamente" para Intermedios, cuadro izq→der, Posiciones finales sólo podio
- [x] T11 Verificación ronda 2: `npx tsc --noEmit` OK · `npm test` 236/236 · `eslint` limpio
- [x] T12 Feedback ronda 3: quitado el tag "Próximamente" del switch; llaves más
      chicas y sin recuadros (separadores de línea), ganador en verde suave
      (`emerald-50`, como el pill "Etapa finalizada"), responsive sin scroll lateral
- [x] T13 Verificación ronda 3: `npx tsc --noEmit` OK · `npm test` OK · `eslint` limpio
- [x] T14 Feedback ronda 4: quitado el encabezado de la card (título con el nombre
      de etapa + subtítulo `phaseLabel(phase)` "Eliminatorias" + badge `EN VIVO`
      duplicado) y el badge `EN VIVO` por partido en las llaves. Queda un solo
      indicador "EN VIVO", el del Hero.
- [x] T15 Verificación ronda 4: `npx tsc --noEmit` OK · `eslint` limpio (0 errores,
      0 warnings) · `npm test` 237/237

## Criterios de aceptación
1. El switch está **debajo del hero y arriba de las cards**, con "Principiantes"
   activo e "Intermedios" visible como opción.
2. El switch permite cambiar de circuito sin recargar.
3. Hay UNA card con 3 pestañas; las tres se pueden ver sin cambiar de fase.
4. Por defecto arranca en "Fase de grupos" hasta el primer resultado de llave.
5. Llaves se lee **de izquierda a derecha**, compacta y sin recuadros por
   partido, con el marcador según la regla (puntos / sets / sólo ganador) y sin
   scroll horizontal en ningún ancho de pantalla.
6. El ganador se marca en un verde suave, al tono del fondo (no saturado).
7. "Posiciones finales" muestra **sólo el podio** (1º, 2º, 3º).
8. `tsc` sin errores y `npm test` en verde.

## Evidencia / Progreso
- Ronda 1 — `npx tsc --noEmit` sin salida; `npm test` 236/236; `eslint` limpio.
- Ronda 2 (feedback del usuario) — `npx tsc --noEmit` sin salida; `npm test`
  236/236 (incluye 4 tests reescritos de `groupBracketColumns`); `eslint` limpio
  sobre los 8 archivos tocados.
- Se agregó `src/lib/front/bracket.test.ts` al script `test` de `package.json`
  (el runner enumera archivos a mano).
- `TournamentSelector.tsx` (desplegable) quedó reemplazado por
  `TournamentSwitch.tsx` y se borró.
- `Hero` ahora recibe `circuit` (el nombre del circuito dejó de estar hardcodeado).
- Ronda 3 (feedback del usuario) — `npx tsc --noEmit` sin salida; `eslint` limpio
  sobre `EliminatoriesView.tsx` y `TournamentSwitch.tsx`; `npm test` verde.
  El conteo pasó de 236 a 237 por un test que agregó **otro workstream** en
  `src/lib/back.integration.test.ts` (modificado 11:01), no por estos cambios.
- `EliminatoriesView` quedó con dos renders del mismo contenido: apilado
  (`sm:hidden`) y en columnas (`hidden sm:flex`, `flex-1 min-w-0`), para no
  scrollear nunca. El ganador usa `bg-emerald-50` + `text-emerald-900`, tomando
  el verde claro que ya usa el pill "Etapa finalizada" del Hero.
- Fix colateral (otro workstream): `scripts/reset-etapa-6.ts` usaba `sets: null`
  sobre un campo `Json?` → `Prisma.DbNull`, para que `tsc` quede limpio.
- Ronda 4 (feedback del usuario: "quita el título CUARTOS WINNERONLY y quita
  Eliminatorias" + "saca tantos En vivo, que aparezca sólo el de arriba") —
  `npx tsc --noEmit` sin salida; `eslint` 0 errores / 0 warnings sobre los 3
  archivos; `npm test` 237/237.
- **Hallazgo**: "CUARTOS WINNERONLY" NO era un texto de la UI, es el **nombre de
  la etapa** que sirve el home. `GET /api/etapas` en la base `dev.db` devuelve
  DOS etapas: `Etapa 6` (2026-09-27, 11 equipos) y `Cuartos WinnerOnly`
  (sin fecha, 11 equipos, ambas `sortOrder 2`). La activa es `Cuartos WinnerOnly`
  — quedó de los scripts del **otro workstream** (test/repair de cuartos).
  El home la muestra en el hero (`Hero.etapaName`) y la mostraba también como
  título de la card.
- `TournamentTabs` perdió la prop `etapaName` y la prop `liveIds` (quedó sin uso
  al sacar el badge `EN VIVO` del encabezado); el encabezado completo de la card
  ya no existe, así que la card abre directo en las pestañas.
- `EN VIVO` sigue existiendo en otros lugares que el usuario no mencionó y que
  hoy no se ven en esta vista: `MatchTicker` (columna "En vivo" + badge, oculto
  cuando hay llaves), `StandingsTables.tsx:154` (badge por equipo en grupos) y
  `AgendaView.tsx`. En las llaves quedó sólo el tinte suave
  (`bg-ember-50/40`) para marcar el partido en cancha, sin texto.
- Decisión abierta: "Posiciones finales" sigue siendo la clasificación de la
  fecha (selector de etapa + podio); falta que el usuario valide la fuente.

## Próximo paso
Mostrar al usuario para iterar visual. Pendiente de decisión del usuario: qué
hacer con la etapa de prueba `Cuartos WinnerOnly` (es la que sirve el home hoy,
y su nombre se sigue viendo en el hero). Pendiente además: cargar los datos de la
etapa según el archivo de Andi y revisar el criterio "mejor vs peor".
